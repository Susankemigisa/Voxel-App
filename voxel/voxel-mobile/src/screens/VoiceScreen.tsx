import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Animated,
} from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import { Header } from '../components/Header'
import { colors, font, spacing, radius } from '../theme'
import { runPipeline, synthesizeTTS } from '../lib/api'
import type { PipelineResponse } from '../lib/api'

type State = 'idle' | 'recording' | 'processing' | 'done' | 'error'

const STEPS = [
  { id: 'audio',  label: 'Cleaning audio'       },
  { id: 'asr',    label: 'Transcribing speech'   },
  { id: 'text',   label: 'Reconstructing text'   },
  { id: 'tts',    label: 'Generating voice'      },
]

export function VoiceScreen() {
  const [state,    setState]   = useState<State>('idle')
  const [result,   setResult]  = useState<PipelineResponse | null>(null)
  const [error,    setError]   = useState<string | null>(null)
  const [steps,    setSteps]   = useState<Record<string, 'pending'|'active'|'done'|'error'>>({
    audio: 'pending', asr: 'pending', text: 'pending', tts: 'pending',
  })
  const [language, setLanguage] = useState<'en'|'lg'>('en')
  const recordingRef = useRef<Audio.Recording | null>(null)
  const pulseAnim    = useRef(new Animated.Value(1)).current
  const soundRef     = useRef<Audio.Sound | null>(null)

  // Pulse animation while recording
  useEffect(() => {
    if (state === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [state])

  const setStep = (id: string, s: 'pending'|'active'|'done'|'error') =>
    setSteps(prev => ({ ...prev, [id]: s }))

  const resetSteps = () =>
    setSteps({ audio: 'pending', asr: 'pending', text: 'pending', tts: 'pending' })

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required.')
        return
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      setState('recording')
      setResult(null)
      setError(null)
      resetSteps()
    } catch (e) {
      Alert.alert('Error', 'Could not start recording')
    }
  }

  const stopRecording = async () => {
    if (!recordingRef.current) return
    setState('processing')
    try {
      await recordingRef.current.stopAndUnloadAsync()
      const uri = recordingRef.current.getURI()
      recordingRef.current = null
      if (!uri) throw new Error('No audio recorded')

      setStep('audio', 'active')
      await new Promise(r => setTimeout(r, 400))
      setStep('audio', 'done')

      setStep('asr', 'active')

      // Pass URI directly as blob-like object for React Native FormData
      const blob = { uri, name: 'recording.m4a', type: 'audio/m4a' } as unknown as Blob
      const data = await runPipeline(blob, { language })
      setStep('asr', 'done')

      setStep('text', 'active')
      await new Promise(r => setTimeout(r, 300))
      setStep('text', 'done')

      if (data.audio_base64) {
        setStep('tts', 'active')
        try {
          // Save base64 audio to a temp file then play it
          const audioPath = `${FileSystem.cacheDirectory}tts_output.wav`
          await FileSystem.writeAsStringAsync(audioPath, data.audio_base64, {
            encoding: FileSystem.EncodingType.Base64,
          })
          await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
          const { sound } = await Audio.Sound.createAsync(
            { uri: audioPath },
            { shouldPlay: true }
          )
          soundRef.current = sound
        } catch (audioErr) {
          console.warn('Audio playback failed:', audioErr)
        }
        setStep('tts', 'done')
      } else {
        setStep('tts', 'done')
      }

      setResult(data)
      setState('done')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Processing failed'
      setError(msg)
      setState('error')
      setSteps(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => { if (next[k] === 'active') next[k] = 'error' })
        return next
      })
    }
  }

  const reset = () => {
    soundRef.current?.stopAsync()
    setState('idle')
    setResult(null)
    setError(null)
    resetSteps()
  }

  const isRecording   = state === 'recording'
  const isProcessing  = state === 'processing'
  const orbColor      = isRecording ? colors.error : isProcessing ? colors.tealLight : colors.teal

  return (
    <View style={styles.flex}>
      <Header title="Voice Input" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Language toggle */}
        <View style={styles.langRow}>
          {(['en','lg'] as const).map(l => (
            <TouchableOpacity
              key={l}
              style={[styles.langBtn, language === l && styles.langBtnActive]}
              onPress={() => setLanguage(l)}
            >
              <Text style={[styles.langText, language === l && styles.langTextActive]}>
                {l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mic orb */}
        <View style={styles.orbSection}>
          <Animated.View style={[styles.orbOuter, { transform: [{ scale: pulseAnim }], borderColor: orbColor + '40' }]}>
            <Animated.View style={[styles.orbMiddle, { borderColor: orbColor + '60' }]}>
              <TouchableOpacity
                style={[styles.orb, { backgroundColor: orbColor }]}
                onPress={isRecording ? stopRecording : state === 'idle' || state === 'done' || state === 'error' ? startRecording : undefined}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing
                  ? <ActivityIndicator color="#fff" size="large" />
                  : <Text style={styles.orbIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
          <Text style={styles.orbLabel}>
            {state === 'idle'       && 'Tap to start recording'}
            {state === 'recording'  && 'Recording… tap to stop'}
            {state === 'processing' && 'Processing your voice…'}
            {state === 'done'       && 'Done! Tap to record again'}
            {state === 'error'      && 'Error. Tap to try again'}
          </Text>
        </View>

        {/* Steps */}
        {state !== 'idle' && (
          <View style={styles.stepsCard}>
            {STEPS.map(step => {
              const s = steps[step.id]
              return (
                <View key={step.id} style={styles.stepRow}>
                  <View style={[styles.stepDot, s === 'done' && styles.stepDotDone, s === 'active' && styles.stepDotActive, s === 'error' && styles.stepDotError]}>
                    {s === 'active' && <ActivityIndicator size="small" color="#fff" />}
                    {s === 'done'   && <Text style={styles.stepCheck}>✓</Text>}
                    {s === 'error'  && <Text style={styles.stepCheck}>✕</Text>}
                  </View>
                  <Text style={[styles.stepLabel, s === 'active' && styles.stepLabelActive]}>{step.label}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Result */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Transcript</Text>
            <Text style={styles.resultText}>{result.raw_transcript}</Text>
            {result.clean_text && result.clean_text !== result.raw_transcript && (
              <>
                <Text style={[styles.resultLabel, { marginTop: spacing.md }]}>Cleaned Text</Text>
                <Text style={styles.resultText}>{result.clean_text}</Text>
              </>
            )}
            <View style={styles.resultMeta}>
              <Text style={styles.metaTag}>🌐 {result.language}</Text>
              <Text style={styles.metaTag}>📊 {Math.round((result.confidence || 0) * 100)}%</Text>
              {result.model_used && <Text style={styles.metaTag}>🤖 {result.model_used}</Text>}
            </View>
            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Record Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  langRow: {
    flexDirection:  'row',
    gap:            spacing.sm,
    marginVertical: spacing.md,
  },
  langBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    radius.md,
    alignItems:      'center',
    backgroundColor: colors.bgCard,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  langBtnActive: {
    backgroundColor: colors.teal + '20',
    borderColor:     colors.teal,
  },
  langText:       { fontSize: font.sm, color: colors.textSub, fontWeight: '600' },
  langTextActive: { color: colors.teal },

  orbSection: {
    alignItems:    'center',
    paddingVertical: spacing.xl,
  },
  orbOuter: {
    width:        180,
    height:       180,
    borderRadius: 90,
    borderWidth:  2,
    alignItems:   'center',
    justifyContent: 'center',
  },
  orbMiddle: {
    width:        150,
    height:       150,
    borderRadius: 75,
    borderWidth:  2,
    alignItems:   'center',
    justifyContent: 'center',
  },
  orb: {
    width:          120,
    height:         120,
    borderRadius:   60,
    alignItems:     'center',
    justifyContent: 'center',
    elevation:      8,
    shadowColor:    colors.teal,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.5,
    shadowRadius:   12,
  },
  orbIcon:  { fontSize: 44 },
  orbLabel: {
    fontSize:  font.md,
    color:     colors.textSub,
    marginTop: spacing.lg,
    textAlign: 'center',
  },

  stepsCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
    marginBottom:    spacing.md,
  },
  stepRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepDot: {
    width:          24,
    height:         24,
    borderRadius:   12,
    backgroundColor: colors.bgElevated,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    colors.border,
  },
  stepDotActive: { backgroundColor: colors.teal,   borderColor: colors.teal   },
  stepDotDone:   { backgroundColor: colors.success, borderColor: colors.success },
  stepDotError:  { backgroundColor: colors.error,   borderColor: colors.error  },
  stepCheck:     { fontSize: 12, color: '#fff', fontWeight: '700' },
  stepLabel:     { fontSize: font.sm, color: colors.textSub },
  stepLabelActive: { color: colors.text, fontWeight: '600' },

  resultCard: {
    backgroundColor: colors.bgCard,
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.teal + '40',
    marginBottom:    spacing.md,
  },
  resultLabel: {
    fontSize:     font.xs,
    color:        colors.teal,
    fontWeight:   '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  spacing.xs,
  },
  resultText: {
    fontSize:   font.md,
    color:      colors.text,
    lineHeight: 24,
  },
  resultMeta: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.md,
    flexWrap:      'wrap',
  },
  metaTag: {
    fontSize:        font.xs,
    color:           colors.textSub,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:    radius.full,
    borderWidth:     1,
    borderColor:     colors.border,
  },

  errorCard: {
    backgroundColor: colors.error + '15',
    borderRadius:    radius.lg,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.error + '40',
    marginBottom:    spacing.md,
  },
  errorText: { fontSize: font.md, color: colors.error, marginBottom: spacing.md },

  resetBtn: {
    backgroundColor: colors.teal,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  resetBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
})