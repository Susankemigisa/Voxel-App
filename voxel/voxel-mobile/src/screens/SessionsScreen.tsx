import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { Header } from '../components/Header'
import { font, spacing, radius } from '../theme'
import { useColors } from '../ThemeContext'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../supabase'

interface Session {
  id:          string
  transcript:  string
  clean_text:  string | null
  language:    string
  created_at:  string
  confidence:  number | null
  model_used:  string | null
}

type LangFilter = 'all' | 'en' | 'lg'

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7)   return `${d} days ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function groupByDate(sessions: Session[]): Record<string, Session[]> {
  const groups: Record<string, Session[]> = {}
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  sessions.forEach(s => {
    const d = new Date(s.created_at)
    let key: string
    if (d.toDateString() === today)     key = 'Today'
    else if (d.toDateString() === yesterday) key = 'Yesterday'
    else key = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  })
  return groups
}

export function SessionsScreen({ onBack }: { onBack: () => void }) {
  const c    = useColors()
  const user = useAuthStore(s => s.user)

  const [sessions,    setSessions]    = useState<Session[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [langFilter,  setLangFilter]  = useState<LangFilter>('all')
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [selectMode,  setSelectMode]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  const fetchSessions = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('transcription_history')
      .select('id, transcript, clean_text, language, created_at, confidence, model_used')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setSessions(data || [])
  }, [user?.id])

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false))
  }, [fetchSessions])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchSessions()
    setRefreshing(false)
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = sessions.filter(s => {
    const matchLang   = langFilter === 'all' || s.language === langFilter
    const q           = search.trim().toLowerCase()
    const matchSearch = !q ||
      (s.clean_text  || '').toLowerCase().includes(q) ||
      (s.transcript  || '').toLowerCase().includes(q)
    return matchLang && matchSearch
  })

  const groups = groupByDate(filtered)

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  const cancelSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────
  const deleteSelected = () => {
    if (selected.size === 0) return
    Alert.alert(
      'Delete Sessions',
      `Delete ${selected.size} session${selected.size > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            const ids = Array.from(selected)
            const { error } = await supabase
              .from('transcription_history')
              .delete()
              .in('id', ids)
              .eq('user_id', user!.id)

            if (error) {
              Alert.alert('Error', 'Could not delete sessions')
            } else {
              setSessions(prev => prev.filter(s => !selected.has(s.id)))
              setSelected(new Set())
              setSelectMode(false)
            }
            setDeleting(false)
          },
        },
      ]
    )
  }

  const deleteAll = () => {
    if (sessions.length === 0) return
    Alert.alert(
      'Delete All Sessions',
      `This will permanently delete all ${sessions.length} session${sessions.length > 1 ? 's' : ''}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All', style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            const { error } = await supabase
              .from('transcription_history')
              .delete()
              .eq('user_id', user!.id)

            if (error) {
              Alert.alert('Error', 'Could not delete sessions')
            } else {
              setSessions([])
              setSelected(new Set())
              setSelectMode(false)
            }
            setDeleting(false)
          },
        },
      ]
    )
  }

  const deleteSingle = (id: string, text: string) => {
    Alert.alert(
      'Delete Session',
      `Delete "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('transcription_history')
              .delete()
              .eq('id', id)
              .eq('user_id', user!.id)
            if (!error) setSessions(prev => prev.filter(s => s.id !== id))
            else Alert.alert('Error', 'Could not delete session')
          },
        },
      ]
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[st.flex, { backgroundColor: c.bg }]}>
      <Header
        title="Sessions"
        showBack
        onBack={selectMode ? cancelSelect : onBack}
        rightIcon={
          sessions.length > 0 ? (
            <View style={st.headerActions}>
              {selectMode ? (
                <>
                  <TouchableOpacity
                    style={[st.headerBtn, { borderColor: c.teal + '50' }]}
                    onPress={selectAll}
                  >
                    <Text style={[st.headerBtnText, { color: c.teal }]}>
                      {selected.size === filtered.length ? 'None' : 'All'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.headerBtn, { borderColor: c.error + '50' }, selected.size === 0 && st.headerBtnDisabled]}
                    onPress={deleteSelected}
                    disabled={selected.size === 0 || deleting}
                  >
                    {deleting
                      ? <ActivityIndicator size="small" color={c.error} />
                      : <Text style={[st.headerBtnText, { color: c.error }]}>
                          Delete{selected.size > 0 ? ` (${selected.size})` : ''}
                        </Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[st.headerBtn, { borderColor: c.border }]}
                    onPress={() => setSelectMode(true)}
                  >
                    <Text style={[st.headerBtnText, { color: c.textSub }]}>Select</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.headerBtn, { borderColor: c.error + '50' }]}
                    onPress={deleteAll}
                  >
                    <Text style={[st.headerBtnText, { color: c.error }]}>Delete All</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.teal} />}
      >
        {/* Summary */}
        <Text style={[st.summary, { color: c.textMuted }]}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          {filtered.length !== sessions.length ? ` · ${filtered.length} shown` : ''}
        </Text>

        {/* Search */}
        <View style={[st.searchWrap, { backgroundColor: c.bgCard, borderColor: c.border }]}>
          <Text style={st.searchIcon}>🔍</Text>
          <TextInput
            style={[st.searchInput, { color: c.text }]}
            placeholder="Search transcriptions…"
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={st.clearBtn}>
              <Text style={[st.clearBtnText, { color: c.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Language filter */}
        <View style={st.filterRow}>
          {(['all', 'en', 'lg'] as LangFilter[]).map(l => (
            <TouchableOpacity
              key={l}
              style={[
                st.filterChip,
                { borderColor: c.border, backgroundColor: c.bgCard },
                langFilter === l && { backgroundColor: c.teal + '20', borderColor: c.teal },
              ]}
              onPress={() => setLangFilter(l)}
            >
              <Text style={[st.filterText, { color: langFilter === l ? c.teal : c.textSub }]}>
                {l === 'all' ? 'All' : l === 'en' ? '🇬🇧 English' : '🇺🇬 Luganda'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loading */}
        {loading && (
          <View style={st.center}>
            <ActivityIndicator color={c.teal} size="large" />
          </View>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && (
          <View style={[st.emptyCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={st.emptyIcon}>🎙️</Text>
            <Text style={[st.emptyTitle, { color: c.text }]}>No sessions yet</Text>
            <Text style={[st.emptySub, { color: c.textSub }]}>
              Your voice transcriptions will appear here after you use Voice Input
            </Text>
          </View>
        )}

        {/* No search results */}
        {!loading && sessions.length > 0 && filtered.length === 0 && (
          <View style={[st.emptyCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
            <Text style={st.emptyIcon}>🔍</Text>
            <Text style={[st.emptyTitle, { color: c.text }]}>No results</Text>
            <Text style={[st.emptySub, { color: c.textSub }]}>
              Try a different search term or language filter
            </Text>
          </View>
        )}

        {/* Session groups */}
        {!loading && Object.entries(groups).map(([date, items]) => (
          <View key={date} style={st.group}>
            <Text style={[st.groupLabel, { color: c.textMuted }]}>{date.toUpperCase()}</Text>

            <View style={[st.groupCard, { backgroundColor: c.bgCard, borderColor: c.border }]}>
              {items.map((session, i) => {
                const isSelected = selected.has(session.id)
                const text = session.clean_text || session.transcript || ''

                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      st.sessionRow,
                      i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                      isSelected && { backgroundColor: c.teal + '10' },
                    ]}
                    onPress={() => selectMode ? toggleSelect(session.id) : null}
                    onLongPress={() => {
                      if (!selectMode) {
                        setSelectMode(true)
                        setSelected(new Set([session.id]))
                      }
                    }}
                    activeOpacity={selectMode ? 0.7 : 1}
                  >
                    {/* Select checkbox */}
                    {selectMode && (
                      <View style={[
                        st.checkbox,
                        { borderColor: isSelected ? c.teal : c.border },
                        isSelected && { backgroundColor: c.teal },
                      ]}>
                        {isSelected && <Text style={st.checkmark}>✓</Text>}
                      </View>
                    )}

                    {/* Language badge */}
                    <View style={[st.langBadge, { backgroundColor: c.teal + '15' }]}>
                      <Text style={[st.langBadgeText, { color: c.teal }]}>
                        {(session.language || 'EN').toUpperCase()}
                      </Text>
                    </View>

                    {/* Content */}
                    <View style={st.sessionContent}>
                      <Text
                        style={[st.sessionText, { color: c.text }]}
                        numberOfLines={2}
                      >
                        {text}
                      </Text>
                      <View style={st.sessionMeta}>
                        <Text style={[st.metaText, { color: c.textMuted }]}>
                          {formatRelative(session.created_at)}
                        </Text>
                        {session.confidence != null && (
                          <Text style={[st.metaText, { color: c.textMuted }]}>
                            · {Math.round(session.confidence * 100)}%
                          </Text>
                        )}
                        {session.model_used && (
                          <Text style={[st.metaText, { color: c.textMuted }]}>
                            · {session.model_used}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Delete single (not in select mode) */}
                    {!selectMode && (
                      <TouchableOpacity
                        style={st.deleteBtn}
                        onPress={() => deleteSingle(session.id, text)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[st.deleteBtnText, { color: c.textMuted }]}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ))}

        {/* Select mode hint */}
        {!selectMode && sessions.length > 0 && (
          <Text style={[st.hint, { color: c.textMuted }]}>
            Long-press any session to select multiple for deletion
          </Text>
        )}

      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  flex:    { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerBtn:     { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  headerBtnDisabled: { opacity: 0.4 },
  headerBtnText: { fontSize: font.xs, fontWeight: '700' },

  summary:   { fontSize: font.xs, marginBottom: spacing.sm, marginTop: spacing.xs },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm, gap: spacing.sm },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: font.md },
  clearBtn:    { padding: 4 },
  clearBtnText: { fontSize: font.sm },

  filterRow:  { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1 },
  filterText: { fontSize: font.xs, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 },

  emptyCard:  { borderRadius: radius.xl, borderWidth: 1, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  emptySub:   { fontSize: font.sm, textAlign: 'center', lineHeight: 20 },

  group:      { marginBottom: spacing.md },
  groupLabel: { fontSize: font.xs, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm },
  groupCard:  { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },

  sessionRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: spacing.sm },
  checkbox:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkmark:      { fontSize: 11, color: '#fff', fontWeight: '700' },
  langBadge:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  langBadgeText:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  sessionContent: { flex: 1 },
  sessionText:    { fontSize: font.sm, lineHeight: 20 },
  sessionMeta:    { flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  metaText:       { fontSize: font.xs },
  deleteBtn:      { padding: 4, flexShrink: 0 },
  deleteBtnText:  { fontSize: 16 },

  hint: { fontSize: font.xs, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
})
