import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../src/lib/supabase'
import { useAppStore } from '../../src/store/authStore'
import { COLORS, RADIUS } from '../../src/lib/theme'

const RELATIONS = ['Doctor', 'Family', 'Friend', 'Caregiver', 'Colleague', 'Other']

interface Contact {
  id:       string
  name:     string
  phone:    string
  relation: string
}

export default function SafetyScreen() {
  const router = useRouter()
  const user   = useAppStore(s => s.user)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [relation, setRelation] = useState('Family')
  const [relOpen,  setRelOpen]  = useState(false)

  useEffect(() => {
    if (!user?.id) return
    loadContacts()
  }, [user?.id])

  async function loadContacts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
    if (error) Alert.alert('Error', error.message)
    else setContacts(data ?? [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required', 'Name and phone number are required')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ user_id: user!.id, name: name.trim(), phone: phone.trim(), relation })
      .select()
      .single()
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setContacts(p => [...p, data])
    setName(''); setPhone(''); setRelation('Family')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    Alert.alert('Remove Contact', 'Are you sure you want to remove this contact?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const { error } = await supabase
            .from('emergency_contacts')
            .delete()
            .eq('id', id)
          if (error) Alert.alert('Error', error.message)
          else setContacts(p => p.filter(c => c.id !== id))
        }
      }
    ])
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.heading}>Safety & SOS</Text>
          <Text style={s.sub}>Emergency contacts</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* SOS banner */}
        <View style={s.sosBanner}>
          <Text style={s.sosIcon}>🚨</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.sosTitle}>SOS Alerts</Text>
            <Text style={s.sosSub}>In an emergency, your contacts below will be notified</Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>EMERGENCY CONTACTS</Text>

        {/* Contacts list */}
        {loading ? (
          <ActivityIndicator color={COLORS.teal} style={{ marginVertical: 30 }} />
        ) : contacts.length === 0 && !adding ? (
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>🚨</Text>
            <Text style={s.emptyTitle}>No contacts yet</Text>
            <Text style={s.emptySub}>Add someone who should be alerted in an emergency</Text>
          </View>
        ) : (
          <View style={s.contactsList}>
            {contacts.map((c, i) => (
              <View key={c.id} style={[s.contactRow, i < contacts.length - 1 && s.contactBorder]}>
                <View style={s.contactAvatar}>
                  <Text style={s.contactAvatarText}>{c.name[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.contactName}>{c.name}</Text>
                  <Text style={s.contactMeta}>{c.phone} · {c.relation}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(c.id)} style={s.deleteBtn}>
                  <Text style={s.deleteText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add form */}
        {adding && (
          <View style={s.addForm}>
            <Text style={s.formLabel}>NAME</Text>
            <TextInput
              style={s.input} value={name} onChangeText={setName}
              placeholder="Full name" placeholderTextColor={COLORS.muted}
            />
            <Text style={s.formLabel}>PHONE NUMBER</Text>
            <TextInput
              style={s.input} value={phone} onChangeText={setPhone}
              placeholder="+256 700 000 000" placeholderTextColor={COLORS.muted}
              keyboardType="phone-pad"
            />
            <Text style={s.formLabel}>RELATION</Text>
            <TouchableOpacity style={s.relSelect} onPress={() => setRelOpen(v => !v)}>
              <Text style={s.relSelectText}>{relation}</Text>
              <Text style={{ color: COLORS.muted }}>{relOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {relOpen && (
              <View style={s.relDropdown}>
                {RELATIONS.map(r => (
                  <TouchableOpacity key={r} style={s.relOption}
                    onPress={() => { setRelation(r); setRelOpen(false) }}>
                    <Text style={[s.relOptionText, r === relation && s.relOptionActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={s.formBtns}>
              <TouchableOpacity style={s.saveContactBtn} onPress={handleAdd} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveContactBtnText}>Save Contact</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelFormBtn}
                onPress={() => { setAdding(false); setName(''); setPhone('') }}>
                <Text style={s.cancelFormText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!adding && (
          <TouchableOpacity style={s.addBtn} onPress={() => setAdding(true)} activeOpacity={0.8}>
            <Text style={s.addBtnText}>+ Add Emergency Contact</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: COLORS.bg },
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  backBtn:           { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  backText:          { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  heading:           { color: COLORS.text, fontWeight: '800', fontSize: 18 },
  sub:               { color: COLORS.subtle, fontSize: 12 },
  scroll:            { flex: 1, paddingHorizontal: 20 },
  sosBanner:         { backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sosIcon:           { fontSize: 24 },
  sosTitle:          { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  sosSub:            { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  sectionLabel:      { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 8 },
  emptyCard:         { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  emptyTitle:        { color: COLORS.text, fontWeight: '600', fontSize: 15, marginBottom: 6 },
  emptySub:          { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  contactsList:      { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  contactRow:        { flexDirection: 'row', alignItems: 'center', padding: 14 },
  contactBorder:     { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  contactAvatar:     { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  contactName:       { color: COLORS.text, fontWeight: '600', fontSize: 14 },
  contactMeta:       { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  deleteBtn:         { padding: 8 },
  deleteText:        { fontSize: 18 },
  addForm:           { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14, gap: 8 },
  formLabel:         { color: COLORS.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  input:             { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 11, color: COLORS.text, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  relSelect:         { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  relSelectText:     { color: COLORS.text, fontSize: 14 },
  relDropdown:       { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  relOption:         { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  relOptionText:     { color: COLORS.subtle, fontSize: 14 },
  relOptionActive:   { color: COLORS.teal2, fontWeight: '600' },
  formBtns:          { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveContactBtn:    { flex: 1, backgroundColor: COLORS.teal, borderRadius: RADIUS.lg, paddingVertical: 13, alignItems: 'center' },
  saveContactBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelFormBtn:     { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelFormText:    { color: COLORS.subtle, fontSize: 14 },
  addBtn:            { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  addBtnText:        { color: COLORS.teal2, fontWeight: '600', fontSize: 14 },
})
