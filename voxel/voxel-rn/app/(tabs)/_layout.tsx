import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../../src/lib/theme'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={s.iconWrap}>
      <Text style={[s.emoji, focused && s.emojiActive]}>{emoji}</Text>
      <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.bar,
        tabBarActiveTintColor:   COLORS.teal2,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home"     focused={focused} /> }} />
      <Tabs.Screen name="voice"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🎙️" label="Voice"    focused={focused} /> }} />
      <Tabs.Screen name="navigate"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Navigate" focused={focused} /> }} />
      <Tabs.Screen name="tts"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🔊" label="Speak"    focused={focused} /> }} />
      <Tabs.Screen name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile"  focused={focused} /> }} />
      <Tabs.Screen name="settings"
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Settings" focused={focused} /> }} />
    </Tabs>
  )
}

const s = StyleSheet.create({
  bar:        { backgroundColor: '#111827', borderTopColor: '#1e2d45', borderTopWidth: 1, height: 70, paddingBottom: 8 },
  iconWrap:   { alignItems: 'center', paddingTop: 4 },
  emoji:      { fontSize: 20, opacity: 0.5 },
  emojiActive:{ opacity: 1 },
  label:      { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  labelActive:{ color: COLORS.teal2 },
})
