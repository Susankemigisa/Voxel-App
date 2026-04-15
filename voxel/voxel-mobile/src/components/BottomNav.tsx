import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, font, spacing } from '../theme'

export type TabName = 'home' | 'voice' | 'navigate' | 'tts' | 'profile'

interface NavItem {
  name:  TabName
  label: string
  icon:  string
}

const NAV_ITEMS: NavItem[] = [
  { name: 'home',     label: 'Home',     icon: '🏠' },
  { name: 'voice',    label: 'Voice',    icon: '🎙️' },
  { name: 'navigate', label: 'Navigate', icon: '🧭' },
  { name: 'tts',      label: 'Speak',    icon: '🔊' },
  { name: 'profile',  label: 'Profile',  icon: '👤' },
]

interface BottomNavProps {
  active:   TabName
  onPress:  (tab: TabName) => void
}

export function BottomNav({ active, onPress }: BottomNavProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.xs }]}>
      <View style={styles.container}>
        {NAV_ITEMS.map(item => {
          const isActive = item.name === active
          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => onPress(item.name)}
              style={styles.item}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
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
  wrapper: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    paddingHorizontal: spacing.md,
    paddingTop:      spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  container: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    alignItems:     'center',
    backgroundColor: colors.bgCard,
    borderRadius:   20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth:    1,
    borderColor:    colors.border,
  },
  item: {
    flex:           1,
    alignItems:     'center',
    gap:            4,
  },
  iconWrap: {
    width:          40,
    height:         34,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.teal + '30',
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize:   font.xs,
    color:      colors.textMuted,
    fontWeight: '500',
  },
  labelActive: {
    color:      colors.teal,
    fontWeight: '700',
  },
})