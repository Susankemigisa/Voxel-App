import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { font, spacing } from '../theme'
import { useColors } from '../ThemeContext'

interface HeaderProps {
  title?:     string
  showBack?:  boolean
  onBack?:    () => void
  rightIcon?: React.ReactNode
}

export function Header({ title, showBack, onBack, rightIcon }: HeaderProps) {
  const insets = useSafeAreaInsets()
  const c      = useColors()

  return (
    <View style={[s.container, { paddingTop: insets.top + spacing.sm, backgroundColor: c.bg }]}>
      <View style={s.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={[s.backBtn, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={[s.backArrow, { color: c.text }]}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.logo, { backgroundColor: c.teal }]}>
            <Text style={s.logoText}>⚡</Text>
          </View>
        )}
        {title && <Text style={[s.title, { color: c.text }]}>{title}</Text>}
      </View>
      {rightIcon && <View>{rightIcon}</View>}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.sm,
  },
  left:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText:  { fontSize: 18 },
  title:     { fontSize: font.lg, fontWeight: '700' },
  backBtn:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backArrow: { fontSize: font.lg },
})
