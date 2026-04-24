import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Animated, Linking,
} from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { Header } from '../components/Header'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'
import { runPipeline } from '../lib/api'
import type { PipelineResponse } from '../lib/api'

type State = 'idle' | 'recording' | 'processing' | 'done' | 'error'

const STEPS = [
  { id: 'audio', label: 'Cleaning audio'      },
  { id: 'asr',   label: 'Transcribing speech' },
  { id: 'text',  label: 'Reconstructing text' },
  { id: 'tts',   label: 'Generating voice'    },
]

/** Open a place name in Google Maps */
function openGoogleMaps(destination: string) {
  const query    = encodeURIComponent(`${destination}, Uganda`)
  const gmapsApp = `comgooglemaps://?q=${query}`
  const gmapsWeb = `https://www.google.com/maps/search/?api=1&query=${query}`
  Linking.canOpenURL(gmapsApp)
    .then(supported => Linking.openURL(supported ? gmapsApp : gmapsWeb))
    .catch(() => Linking.openURL(gmapsWeb))
}

export function VoiceScreen() {
  const c = useColors()
  const styles = getStyles(c)
  const [state,    setState]   = useState<State>('idle')
  const [result,   setResult]  = useState<PipelineResponse | null>(null)
  const [error,    setError]   = useState<string | null>(null)
  const [steps,    setSteps]   = useState<Record<string, 'pending'|'active'|'done'|'error'>>({
    audio: 'pending', asr: 'pending', text: 'pending', tts: 'pending',
  })
  const [language,   setLanguage]   = useState<'en'|'lg'>('en')
  const [audioPath,  setAudioPath]  = useState<string | null>(null)
  const [playing,    setPlaying]    = useState(false)
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

      // Pass URI as blob-like object for React Native FormData
      const blob = { uri, name: 'recording.m4a', type: 'audio/m4a' } as unknown as Blob
      const data = await runPipeline(blob, {
        language,
        outputMode: 'both',  // always request TTS audio back
      })
      setStep('asr', 'done')

      setStep('text', 'active')
      await new Promise(r => setTimeout(r, 300))
      setStep('text', 'done')

      // Play TTS audio if present (works for both English AND Luganda)
      if (data.audio_base64) {
        setStep('tts', 'active')
        try {
          // Unload any previous sound
          if (soundRef.current) {
            try { await soundRef.current.stopAsync() } catch {}
            try { await soundRef.current.unloadAsync() } catch {}
            soundRef.current = null
          }
          // CRITICAL: switch audio session from recording → playback
          await Audio.setAudioModeAsync({
            allowsRecordingIOS:    false,
            playsInSilentModeIOS:  true,
            staysActiveInBackground: false,
            shouldDuckAndroid:     false,
            playThroughEarpieceAndroid: false,
          })
          const newAudioPath = `${FileSystem.cacheDirectory}voxel_tts_${Date.now()}.wav`
          await FileSystem.writeAsStringAsync(newAudioPath, data.audio_base64, {
            encoding: 'base64',
          })
          setAudioPath(newAudioPath)
          setPlaying(true)
          const { sound } = await Audio.Sound.createAsync(
            { uri: newAudioPath },
            { shouldPlay: true, volume: 1.0 }
          )
          soundRef.current = sound
          sound.setOnPlaybackStatusUpdate(status => {
            if (status.isLoaded && status.didJustFinish) {
              setPlaying(false)
              sound.unloadAsync().catch(() => {})
              soundRef.current = null
            }
          })
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

  // Cancel recording — stop and discard, go back to idle
  const cancelRecording = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync()
      } catch {}
      recordingRef.current = null
    }
    // Reset audio mode
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
    } catch {}
    setState('idle')
    setResult(null)
    setError(null)
    resetSteps()
  }

  const reset = () => {
    soundRef.current?.stopAsync().catch(() => {})
    setState('idle')
    setResult(null)
    setError(null)
    resetSteps()
  }

  const replayAudio = async () => {
    if (!audioPath || playing) return
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync() } catch {}
        try { await soundRef.current.unloadAsync() } catch {}
        soundRef.current = null
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:         false,
        playsInSilentModeIOS:       true,
        shouldDuckAndroid:          false,
        playThroughEarpieceAndroid: false,
      })
      setPlaying(true)
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioPath },
        { shouldPlay: true, volume: 1.0 }
      )
      soundRef.current = sound
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlaying(false)
          sound.unloadAsync().catch(() => {})
          soundRef.current = null
        }
      })
    } catch {
      setPlaying(false)
    }
  }

  const isRecording   = state === 'recording'
  const isProcessing  = state === 'processing'
  const orbColor      = isRecording ? c.error : isProcessing ? c.tealLight : c.teal

  // Check if there is navigation intent in the result
  const navIntent = result?.navigation_intent

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
            {state === 'recording'  && 'Recording… tap mic to stop'}
            {state === 'processing' && 'Processing your voice…'}
            {state === 'done'       && 'Done! Tap to record again'}
            {state === 'error'      && 'Error. Tap to try again'}
          </Text>

          {/* Cancel button — only during recording */}
          {isRecording && (
            <TouchableOpacity
              style={styles.cancelRecordBtn}
              onPress={cancelRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelRecordText}>✕  Cancel</Text>
            </TouchableOpacity>
          )}
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
              <Text style={styles.metaTag}>🌐 {result.language === 'lg' ? 'Luganda' : 'English'}</Text>
              <Text style={styles.metaTag}>📊 {Math.round((result.confidence || 0) * 100)}%</Text>
              {result.model_used && <Text style={styles.metaTag}>🤖 {result.model_used}</Text>}
              {result.audio_base64 && (
                <TouchableOpacity
                  style={[styles.replayBtn, playing && styles.replayBtnActive]}
                  onPress={playing ? undefined : replayAudio}
                  disabled={playing}
                >
                  {playing
                    ? <><ActivityIndicator size="small" color="#fff" style={{ marginRight: 4 }} /><Text style={styles.replayBtnText}>Playing…</Text></>
                    : <Text style={styles.replayBtnText}>🔊  Play Audio</Text>
                  }
                </TouchableOpacity>
              )}
            </View>

            {/* Navigation intent button — shown when a place is detected */}
            {navIntent?.is_navigation && navIntent.destination ? (
              <View style={styles.navIntentBox}>
                <Text style={styles.navIntentLabel}>📍 Navigation detected</Text>
                <Text style={styles.navIntentDest}>{navIntent.destination}</Text>
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => openGoogleMaps(navIntent.destination)}
                >
                  <Text style={styles.mapBtnText}>🗺️ Open in Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mapBtn, styles.directionsBtn]}
                  onPress={() => {
                    const dest = encodeURIComponent(`${navIntent.destination}, Uganda`)
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`)
                  }}
                >
                  <Text style={[styles.mapBtnText, styles.directionsBtnText]}>🧭 Get Directions</Text>
                </TouchableOpacity>
              </View>
            ) : null}

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

const getStyles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  flex:    { flex: 1, backgroundColor: c.bg },
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
    backgroundColor: c.bgCard,
    borderWidth:     1,
    borderColor:     c.border,
  },
  langBtnActive: {
    backgroundColor: c.teal + '20',
    borderColor:     c.teal,
  },
  langText:       { fontSize: font.sm, color: c.textSub, fontWeight: '600' },
  langTextActive: { color: c.teal },

  orbSection: {
    alignItems:      'center',
    paddingVertical: spacing.xl,
  },
  orbOuter: {
    width:          180, height: 180, borderRadius: 90, borderWidth: 2,
    alignItems:     'center', justifyContent: 'center',
  },
  orbMiddle: {
    width:          150, height: 150, borderRadius: 75, borderWidth: 2,
    alignItems:     'center', justifyContent: 'center',
  },
  orb: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: c.teal,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12,
  },
  orbIcon:  { fontSize: 44 },
  orbLabel: { fontSize: font.md, color: c.textSub, marginTop: spacing.lg, textAlign: 'center' },

  stepsCard: {
    backgroundColor: c.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: c.border, gap: spacing.sm, marginBottom: spacing.md,
  },
  stepRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: c.bgElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border,
  },
  stepDotActive: { backgroundColor: c.teal,   borderColor: c.teal   },
  stepDotDone:   { backgroundColor: c.success, borderColor: c.success },
  stepDotError:  { backgroundColor: c.error,   borderColor: c.error  },
  stepCheck:     { fontSize: 12, color: '#fff', fontWeight: '700' },
  stepLabel:     { fontSize: font.sm, color: c.textSub },
  stepLabelActive: { color: c.text, fontWeight: '600' },

  resultCard: {
    backgroundColor: c.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: c.teal + '40', marginBottom: spacing.md,
  },
  resultLabel: {
    fontSize: font.xs, color: c.teal, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.xs,
  },
  resultText: { fontSize: font.md, color: c.text, lineHeight: 24 },
  resultMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  metaTag: {
    fontSize: font.xs, color: c.textSub, backgroundColor: c.bgElevated,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border,
  },

  // Navigation intent box
  navIntentBox: {
    marginTop: spacing.md, backgroundColor: c.teal + '10',
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: c.teal + '30',
  },
  navIntentLabel: { fontSize: font.xs, color: c.teal, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  navIntentDest:  { fontSize: font.lg, fontWeight: '700', color: c.text, marginTop: 4, marginBottom: spacing.sm },

  mapBtn: {
    backgroundColor: c.teal, borderRadius: radius.md,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs,
  },
  mapBtnText:        { fontSize: font.md, fontWeight: '700', color: '#fff' },
  directionsBtn:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.teal },
  directionsBtnText: { color: c.teal },

  errorCard: {
    backgroundColor: c.error + '15', borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: c.error + '40', marginBottom: spacing.md,
  },
  errorText: { fontSize: font.md, color: c.error, marginBottom: spacing.md },

  resetBtn: {
    backgroundColor: c.teal, borderRadius: radius.md,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.sm,
  },
  resetBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },

  cancelRecordBtn: {
    marginTop:         spacing.lg,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       c.error + '60',
    backgroundColor:   c.error + '10',
    alignItems:        'center' as const,
  },
  cancelRecordText: {
    fontSize:   font.md,
    fontWeight: '700' as const,
    color:      c.error,
  },

  replayBtn: {
    flexDirection:     'row' as const,
    alignItems:        'center' as const,
    justifyContent:    'center' as const,
    backgroundColor:   c.teal,
    borderRadius:      radius.full,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop:         spacing.md,
    gap:               4,
  },
  replayBtnActive: {
    backgroundColor: c.teal + 'aa',
  },
  replayBtnText: {
    fontSize:   font.md,
    fontWeight: '700' as const,
    color:      '#fff',
  },
})