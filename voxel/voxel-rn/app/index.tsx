import { Redirect } from 'expo-router'

// Root redirect — AuthGate in _layout.tsx handles the actual routing
// This just ensures / doesn't 404
export default function Index() {
  return <Redirect href="/(auth)/login" />
}
