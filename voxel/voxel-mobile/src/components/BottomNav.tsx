import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, font, spacing } from '../theme'

export type TabName = 'home' | 'voice' | 'navigate' | 'tts' | 'settings'

const NAV_ITEMS = [
  { name: 'home'     as TabName, label: 'Home',     icon: '🏠' },
  { name: 'voice'    as TabName, label: 'Voice',    icon: '🎙️' },
  { name: 'navigate' as TabName, label: 'Navigate', icon: '🧭' },
  { name: 'tts'      as TabName, label: 'Speak',    icon: '🔊' },
  { name: 'settings' as TabName, label: 'Settings', icon: '⚙️' },
]

interface Props {
  active:  TabName
  onPress: (tab: TabName) => void
  isDark?: boolean
}

export function BottomNav({ active, onPress, isDark = true }: Props) {
  const insets  = useSafeAreaInsets()
  const bg      = isDark ? colors.bg      : '#f0f4ff'
  const card    = isDark ? colors.bgCard  : '#ffffff'
  const border  = isDark ? colors.border  : '#e2e8f0'
  const muted   = isDark ? colors.textMuted : '#94a3b8'

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.xs, backgroundColor: bg, borderTopColor: border }]}>
      <View style={[styles.container, { backgroundColor: card, borderColor: border }]}>
        {NAV_ITEMS.map(item => {
          const isActive = item.name === active
          return (
            <TouchableOpacity key={item.name} onPress={() => onPress(item.name)} style={styles.item} activeOpacity={0.7}>
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={[styles.label, { color: isActive ? colors.teal : muted }, isActive && styles.labelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:       { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  container:     { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: 20, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderWidth: 1 },
  item:          { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap:      { width: 40, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.teal + '30' },
  icon:          { fontSize: 18 },
  label:         { fontSize: font.xs, fontWeight: '500' },
  labelActive:   { fontWeight: '700' },
})