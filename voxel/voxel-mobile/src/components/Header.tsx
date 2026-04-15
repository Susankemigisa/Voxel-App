import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, font, spacing } from '../theme'

interface HeaderProps {
  title?:      string
  showBack?:   boolean
  onBack?:     () => void
  rightIcon?:  React.ReactNode
}

export function Header({ title, showBack, onBack, rightIcon }: HeaderProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.logo}>
            <Text style={styles.logoText}>⚡</Text>
          </View>
        )}
        {title && <Text style={styles.title}>{title}</Text>}
      </View>
      {rightIcon && <View>{rightIcon}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom:   spacing.sm,
    backgroundColor: colors.bg,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  logo: {
    width:          36,
    height:         36,
    borderRadius:   10,
    backgroundColor: colors.teal,
    alignItems:     'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
  },
  title: {
    fontSize:   font.lg,
    fontWeight: '700',
    color:      colors.text,
  },
  backBtn: {
    width:          36,
    height:         36,
    borderRadius:   10,
    backgroundColor: colors.bgCard,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1,
    borderColor:    colors.border,
  },
  backArrow: {
    fontSize:  font.lg,
    color:     colors.text,
  },
})