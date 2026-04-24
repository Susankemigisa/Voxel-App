import React, { useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'

const { width } = Dimensions.get('window')

interface Props {
  onGetStarted: () => void
  onSignIn:     () => void
}

function WaveAnimation() {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue:         1,
        duration:        3000,
        useNativeDriver: true,
      })
    ).start()
  }, [])

  // Simple animated dots representing a waveform
  return (
    <View style={wave.container}>
      {[...Array(12)].map((_, i) => {
        const delay = i * 150
        const barAnim = useRef(new Animated.Value(0.3)).current
        useEffect(() => {
          Animated.loop(
            Animated.sequence([
              Animated.delay(delay),
              Animated.timing(barAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
              Animated.timing(barAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            ])
          ).start()
        }, [])
        return (
          <Animated.View
            key={i}
            style={[wave.bar, { transform: [{ scaleY: barAnim }] }]}
          />
        )
      })}
    </View>
  )
}

const wave = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    height:         40,
    marginVertical: spacing.md,
  },
  bar: {
    width:           3,
    height:          24,
    borderRadius:    2,
    backgroundColor: 'rgba(11,148,136,0.5)',
  },
})

export function LandingScreen({ onGetStarted, onSignIn }: Props) {
  const c = useColors()
  const styles = getStyles(c)
  const insets = useSafeAreaInsets()

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start()
  }, [])

  const STATS = [
    { value: '94%',  label: 'ASR Accuracy'   },
    { value: '2',    label: 'Languages'       },
    { value: '<1s',  label: 'Response'        },
    { value: '50+',  label: 'Transcriptions'  },
  ]

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.logoText}>VOXEL</Text>
        </View>
        <TouchableOpacity style={styles.signInTopBtn} onPress={onSignIn}>
          <Text style={styles.signInTopText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      {/* Badge */}
      <View style={styles.badge}>
        <View style={styles.badgeDot} />
        <Text style={styles.badgeText}>Now supporting Luganda · English</Text>
      </View>

      {/* Hero */}
      <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.heroLogo}>
          <Text style={styles.heroLogoIcon}>⚡</Text>
        </View>
        <Text style={styles.heroTitle}>
          {'Speak freely.\n'}
          <Text style={styles.heroTitleTeal}>Be understood.</Text>
        </Text>
        <Text style={styles.heroSub}>
          AI-powered speech assistance that turns imperfect speech into clear communication — in English and Luganda.
        </Text>
      </Animated.View>

      {/* Waveform */}
      <WaveAnimation />
      <Text style={styles.waveLabel}>Live speech processing</Text>

      {/* CTA buttons */}
      <View style={styles.btns}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Get Started Free →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onSignIn} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {STATS.map((s, i) => (
          <React.Fragment key={s.label}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
            {i < STATS.length - 1 && <View style={styles.statDivider} />}
          </React.Fragment>
        ))}
      </View>

    </View>
  )
}

const getStyles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: c.bg,
    paddingHorizontal: spacing.lg,
    paddingBottom:   spacing.xl,
  },

  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: {
    width:          32,
    height:         32,
    borderRadius:   8,
    backgroundColor: c.text,
    alignItems:     'center',
    justifyContent: 'center',
  },
  logoIcon:  { fontSize: 18 },
  logoText: {
    fontSize:    font.md,
    fontWeight:  '800',
    color:       c.text,
    letterSpacing: 2,
  },
  signInTopBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       c.border,
  },
  signInTopText: { fontSize: font.sm, color: c.text, fontWeight: '600' },

  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'center',
    gap:               spacing.xs,
    backgroundColor:   c.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.full,
    borderWidth:       1,
    borderColor:       c.border,
    marginVertical:    spacing.lg,
  },
  badgeDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: c.teal,
  },
  badgeText: { fontSize: font.xs, color: c.textSub },

  hero:      { alignItems: 'center' },
  heroLogo: {
    width:          64,
    height:         64,
    borderRadius:   32,
    backgroundColor: c.text,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   spacing.lg,
  },
  heroLogoIcon: { fontSize: 32 },
  heroTitle: {
    fontSize:   font.xxxl,
    fontWeight: '800',
    color:      c.text,
    textAlign:  'center',
    lineHeight: 40,
  },
  heroTitleTeal: { color: c.teal },
  heroSub: {
    fontSize:    font.sm,
    color:       c.textSub,
    textAlign:   'center',
    lineHeight:  22,
    marginTop:   spacing.md,
    paddingHorizontal: spacing.md,
  },

  waveLabel: {
    fontSize:  font.xs,
    color:     c.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  btns: {
    flexDirection:  'row',
    gap:            spacing.sm,
    marginBottom:   spacing.xl,
  },
  primaryBtn: {
    flex:            1,
    backgroundColor: c.teal,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  primaryBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
  secondaryBtn: {
    flex:            1,
    backgroundColor: c.bgCard,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     c.border,
  },
  secondaryBtnText: { fontSize: font.md, fontWeight: '600', color: c.text },

  statsRow: {
    flexDirection:   'row',
    backgroundColor: c.bgCard,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     c.border,
    paddingVertical: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: font.lg, fontWeight: '800', color: c.text },
  statLabel: { fontSize: font.xs, color: c.textSub, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: c.border },
})