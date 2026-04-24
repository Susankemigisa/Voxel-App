import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { font, spacing } from '../theme'
import { useColors } from '../ThemeContext'

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
  isDark?: boolean  // kept for API compat but not used — we read from context
}

export function BottomNav({ active, onPress }: Props) {
  const insets = useSafeAreaInsets()
  const c      = useColors()

  return (
    <View style={[
      s.wrapper,
      { paddingBottom: insets.bottom + spacing.xs, backgroundColor: c.bg, borderTopColor: c.border }
    ]}>
      <View style={[s.container, { backgroundColor: c.bgCard, borderColor: c.border }]}>
        {NAV_ITEMS.map(item => {
          const isActive = item.name === active
          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => onPress(item.name)}
              style={s.item}
              activeOpacity={0.7}
            >
              <View style={[s.iconWrap, isActive && { backgroundColor: c.teal + '30' }]}>
                <Text style={s.icon}>{item.icon}</Text>
              </View>
              <Text style={[s.label, { color: isActive ? c.teal : c.textMuted }, isActive && s.labelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrapper:    { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  container:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: 20, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderWidth: 1 },
  item:       { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap:   { width: 40, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  icon:       { fontSize: 18 },
  label:      { fontSize: font.xs, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
})
