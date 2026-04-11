import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Text,
  View,
  Modal,
  Dimensions,
  FlatList,
} from "react-native";
import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { BACKEND_BASE_URL } from "./src/config";
import {
  extractNavigation,
  healthCheck,
  pipelineEndpointUrl,
  type Language,
  type NavigationExtractResponse,
  type PipelineResponse,
  runPipeline,
  synthesizeTTS,
  type VoiceGender,
} from "./src/lib/api";

type ScreenState = "idle" | "recording" | "processing";
type Tab = "home" | "voice" | "navigate" | "tts" | "profile";
type EditingPreference = "language" | "voice" | "pitch" | "rate" | null;

interface RouteData {
  origin: [number, number];
  destination: [number, number];
  label: string;
  distance: string;
  duration: string;
}

const UGANDA_PLACES: Record<string, [number, number]> = {
  kampala: [0.3476, 32.5825],
  entebbe: [0.0423, 32.4435],
  jinja: [0.4137, 33.135],
  gulu: [2.7777, 32.2833],
  mbarara: [-0.6117, 29.6363],
  mbale: [1.0543, 34.2682],
  tororo: [1.1883, 33.7936],
  ntinda: [0.3699, 32.5857],
  kawempe: [0.4167, 32.5667],
  nakawa: [0.3733, 32.6167],
  makerere: [0.3425, 32.574],
  kololo: [0.2881, 32.5753],
  bukoto: [0.3604, 32.5933],
  kira: [0.3458, 32.7292],
  namugongo: [0.334, 32.5833],
};

function Card({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.homeCard}>
      <Text style={styles.homeCardTitle}>{title}</Text>
      <Text style={styles.homeCardSub}>{subtitle}</Text>
    </Pressable>
  );
}

function MapModal({ route, visible, onClose }: { route: RouteData | null; visible: boolean; onClose: () => void }) {
  if (!route) return null;

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: sans-serif; }
    #map { width: 100vw; height: 100vh; }
    .info-box { position: absolute; bottom: 20px; left: 20px; background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.2); z-index: 1000; max-width: 200px; }
    .info-label { font-size: 12px; color: #666; font-weight: bold; }
    .info-value { font-size: 14px; color: #333; font-weight: 600; margin-top: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="info-box">
    <div class="info-label">📍 Destination</div>
    <div class="info-value">${route.label}</div>
    <div class="info-label" style="margin-top: 8px;">📏 Distance</div>
    <div class="info-value">${route.distance}</div>
    <div class="info-label" style="margin-top: 8px;">⏱️ Duration</div>
    <div class="info-value">${route.duration}</div>
  </div>
  <script>
    const map = L.map('map').setView([${route.origin[0]}, ${route.origin[1]}], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    
    const origin = [${route.origin[0]}, ${route.origin[1]}];
    const dest = [${route.destination[0]}, ${route.destination[1]}];
    
    L.marker(origin, {
      icon: L.divIcon({
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#14b8a6;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',
        className: '',
        iconAnchor: [7, 7]
      })
    }).addTo(map).bindPopup('Your Location');
    
    L.marker(dest, {
      icon: L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',
        className: '',
        iconAnchor: [8, 8]
      })
    }).addTo(map).bindPopup('Destination');
    
    map.fitBounds([origin, dest], { padding: [48, 48] });
    
    // Fetch route from OSRM
    fetch('https://router.project-osrm.org/route/v1/car/${route.origin[1]},${route.origin[0]};${route.destination[1]},${route.destination[0]}?geometries=geojson&overview=full')
      .then(r => r.json())
      .then(data => {
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          L.polyline(coords, { color: '#14b8a6', weight: 4, opacity: 0.8 }).addTo(map);
        }
      });
  </script>
</body>
</html>
  `;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.mapModal}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>{route.label}</Text>
          <Pressable onPress={onClose} style={styles.mapCloseBtn}>
            <Text style={styles.mapCloseText}>✕</Text>
          </Pressable>
        </View>
        <WebView source={{ html: mapHtml }} style={styles.mapWebView} />
      </SafeAreaView>
    </Modal>
  );
}

function PickerModal({
  visible,
  onClose,
  title,
  options,
  value,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.pickerClose}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item);
                  onClose();
                }}
                style={[styles.pickerOption, value === item && styles.pickerOptionSelected]}
              >
                <Text style={[styles.pickerOptionText, value === item && styles.pickerOptionTextSelected]}>
                  {item === "1.0" ? "Normal" : value === "female" ? "Female" : value === "male" ? "Male" : value === "en" ? "English" : value === "lg" ? "Luganda" : item}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [state, setState] = useState<ScreenState>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Preferences
  const [language, setLanguage] = useState<Language>("lg");
  const [voice, setVoice] = useState<VoiceGender>("female");
  const [pitch, setPitch] = useState("0.5");
  const [rate, setRate] = useState("1.0");

  // Map and routing
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [editingPref, setEditingPref] = useState<EditingPreference>(null);

  // Navigation
  const [navInput, setNavInput] = useState("");
  const [navResult, setNavResult] = useState<NavigationExtractResponse | null>(null);
  const [navLoading, setNavLoading] = useState(false);

  // TTS
  const [ttsText, setTtsText] = useState("Please help me find the main entrance.");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudioB64, setTtsAudioB64] = useState("");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const canRecord = useMemo(() => state !== "processing", [state]);

  async function startRecording() {
    if (!canRecord) return;
    setError("");
    setResult(null);

    try {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.warn("Unload error:", e);
        }
        soundRef.current = null;
      }
      setIsPlaying(false);

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError("Microphone permission is required.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setState("recording");
    } catch (e) {
      setError(`Could not start recording: ${String(e)}`);
      setState("idle");
    }
  }

  async function stopRecordingAndProcess() {
    if (!recordingRef.current) return;

    setState("processing");
    setError("");

    try {
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error("Recording URI was empty.");
      }

      const pipelineResult = await runPipeline({
        fileUri: uri,
        language,
        outputMode: "both",
        voice,
        pitch: parseFloat(pitch),
        rate: parseFloat(rate),
      });

      setResult(pipelineResult);
      setState("idle");
    } catch (e) {
      setError(`Pipeline failed: ${String(e)}`);
      setState("idle");
    }
  }

  async function togglePlayback() {
    const source = result?.audio_base64 || ttsAudioB64;
    if (!source) return;

    if (isPlaying && soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
      } catch (e) {
        console.warn("Pause error:", e);
      }
      setIsPlaying(false);
      return;
    }

    try {
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.warn("Unload error:", e);
        }
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${source}` },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlaying(false);
          soundRef.current = null;
        }
      });

      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      setError(`Audio playback failed: ${String(e)}`);
      setIsPlaying(false);
      soundRef.current = null;
    }
  }

  async function handleNavigationExtract() {
    if (!navInput.trim()) return;
    setError("");
    setNavLoading(true);
    try {
      const extracted = await extractNavigation(navInput.trim(), language);
      setNavResult(extracted);

      // Auto-generate route if destination found
      if (extracted.is_navigation && extracted.destination) {
        const destCoords = UGANDA_PLACES[extracted.destination.toLowerCase()];
        if (destCoords) {
          setCurrentRoute({
            origin: [0.3476, 32.5825], // Kampala
            destination: destCoords,
            label: extracted.destination,
            distance: "~15km",
            duration: "~30 min",
          });
        }
      }
    } catch (e) {
      setError(`Navigation extract failed: ${String(e)}`);
    } finally {
      setNavLoading(false);
    }
  }

  async function handleTTS() {
    if (!ttsText.trim()) return;
    setError("");
    setTtsLoading(true);
    try {
      const response = await synthesizeTTS({
        text: ttsText.trim(),
        language,
        voice,
        pitch: parseFloat(pitch),
        rate: parseFloat(rate),
      });
      setTtsAudioB64(response.audio_base64 || "");
    } catch (e) {
      setError(`TTS failed: ${String(e)}`);
    } finally {
      setTtsLoading(false);
    }
  }

  function renderHome() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dashboard</Text>
        <View style={styles.homeGrid}>
          <Card title="Voice" subtitle="Record and process speech" onPress={() => setTab("voice")} />
          <Card title="Navigate" subtitle="Extract destination intent" onPress={() => setTab("navigate")} />
          <Card title="Text to Speech" subtitle="Synthesize spoken audio" onPress={() => setTab("tts")} />
          <Card title="Profile" subtitle="Preferences and settings" onPress={() => setTab("profile")} />
        </View>
      </View>
    );
  }

  function renderVoice() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voice Pipeline</Text>
        <Pressable
          onPress={state === "recording" ? stopRecordingAndProcess : startRecording}
          disabled={!canRecord}
          style={[styles.mainButton, state === "recording" && styles.mainButtonRecording]}
        >
          <Text style={styles.mainButtonText}>
            {state === "recording" ? "Stop + Process" : "Start Recording"}
          </Text>
        </Pressable>
        {state === "processing" && (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#14b8a6" />
            <Text style={styles.processingText}>Processing voice pipeline...</Text>
          </View>
        )}
        {result && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Result</Text>
            <Text style={styles.label}>Raw Transcript</Text>
            <Text style={styles.value}>{result.raw_transcript || "-"}</Text>
            <Text style={styles.label}>Clean Text</Text>
            <Text style={styles.value}>{result.clean_text || "-"}</Text>
            <Text style={styles.label}>Confidence</Text>
            <Text style={styles.value}>{Math.round((result.confidence || 0) * 100)}%</Text>
            <Pressable
              onPress={togglePlayback}
              disabled={!result.audio_base64}
              style={[styles.secondaryButton, !result.audio_base64 && styles.secondaryButtonDisabled]}
            >
              <Text style={styles.secondaryButtonText}>
                {!result.audio_base64 ? "No Audio" : isPlaying ? "Pause Audio" : "Play Audio"}
              </Text>
            </Pressable>

            {/* Navigation Results */}
            {result.navigation_intent?.is_navigation && (
              <View style={[styles.card, { marginTop: 12, borderColor: "#14b8a6", borderWidth: 2 }]}>
                <Text style={[styles.cardTitle, { color: "#14b8a6" }]}>📍 Navigation Detected</Text>
                <Text style={styles.label}>Destination</Text>
                <Text style={styles.value}>{result.navigation_intent.destination}</Text>
                <Text style={styles.label}>Confidence</Text>
                <Text style={styles.value}>{Math.round((result.navigation_intent.confidence || 0) * 100)}%</Text>
                <Pressable
                  onPress={() => {
                    const destCoords = UGANDA_PLACES[result.navigation_intent?.destination.toLowerCase() || ""];
                    if (destCoords) {
                      setCurrentRoute({
                        origin: [0.3476, 32.5825],
                        destination: destCoords,
                        label: result.navigation_intent?.destination || "Destination",
                        distance: "~15km",
                        duration: "~30 min",
                      });
                      setMapModalVisible(true);
                    }
                  }}
                  style={styles.mainButton}
                >
                  <Text style={styles.mainButtonText}>🗺️ View Route</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderNavigate() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navigate</Text>
        <TextInput
          value={navInput}
          onChangeText={setNavInput}
          placeholder="Type transcript or destination phrase"
          placeholderTextColor="#71829b"
          style={styles.input}
          multiline
        />
        <Pressable onPress={handleNavigationExtract} style={styles.mainButton}>
          <Text style={styles.mainButtonText}>{navLoading ? "Extracting..." : "Extract Destination"}</Text>
        </Pressable>

        {navResult && navResult.is_navigation && (
          <View style={styles.mapCard}>
            <View style={styles.mapContainer}>
              <Text style={styles.mapMarker}>📍</Text>
              <Text style={styles.mapDestination}>{navResult.destination}</Text>
            </View>
            <View style={styles.locationDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Destination</Text>
                <Text style={styles.detailValue}>{navResult.destination}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Confidence</Text>
                <Text style={styles.detailValue}>{Math.round((navResult.confidence || 0) * 100)}%</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Source</Text>
                <Text style={styles.detailValue}>{navResult.reason}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                if (currentRoute) {
                  setMapModalVisible(true);
                }
              }}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>🗺️ View Route</Text>
            </Pressable>
          </View>
        )}

        {navResult && !navResult.is_navigation && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Not a Navigation Request</Text>
            <Text style={styles.value}>Try phrases like: "take me to Kampala" or "genda ku Jinja"</Text>
          </View>
        )}
      </View>
    );
  }

  function renderTTS() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Text To Speech</Text>
        <TextInput
          value={ttsText}
          onChangeText={setTtsText}
          placeholder="Enter text to synthesize"
          placeholderTextColor="#71829b"
          style={styles.input}
          multiline
        />
        <Pressable onPress={handleTTS} style={styles.mainButton}>
          <Text style={styles.mainButtonText}>{ttsLoading ? "Synthesizing..." : "Synthesize"}</Text>
        </Pressable>
        {!!ttsAudioB64 && (
          <Pressable onPress={togglePlayback} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{isPlaying ? "Pause Audio" : "Play Audio"}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  function renderProfile() {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account & Settings</Text>

        {/* Account Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <View style={styles.profileRow}>
            <View style={styles.profileIcon}>
              <Text style={styles.profileIconText}>👤</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Guest User</Text>
              <Text style={styles.profileEmail}>Not logged in</Text>
            </View>
          </View>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign In or Create Account</Text>
          </Pressable>
        </View>

        {/* Preferences Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>

          <Pressable
            onPress={() => setEditingPref("language")}
            style={styles.editableOption}
          >
            <View>
              <Text style={styles.settingLabel}>Preferred Language</Text>
              <Text style={styles.settingValue}>{language === "en" ? "English" : "Luganda"}</Text>
            </View>
            <Text style={styles.editIcon}>✎</Text>
          </Pressable>

          <Pressable
            onPress={() => setEditingPref("voice")}
            style={styles.editableOption}
          >
            <View>
              <Text style={styles.settingLabel}>Default Voice</Text>
              <Text style={styles.settingValue}>{voice === "female" ? "Female" : voice === "male" ? "Male" : "Robot"}</Text>
            </View>
            <Text style={styles.editIcon}>✎</Text>
          </Pressable>

          <Pressable
            onPress={() => setEditingPref("pitch")}
            style={styles.editableOption}
          >
            <View>
              <Text style={styles.settingLabel}>Pitch</Text>
              <Text style={styles.settingValue}>{pitch}</Text>
            </View>
            <Text style={styles.editIcon}>✎</Text>
          </Pressable>

          <Pressable
            onPress={() => setEditingPref("rate")}
            style={[styles.editableOption, { borderBottomWidth: 0 }]}
          >
            <View>
              <Text style={styles.settingLabel}>Speech Rate</Text>
              <Text style={styles.settingValue}>{rate === "1.0" ? "Normal (1.0x)" : rate}</Text>
            </View>
            <Text style={styles.editIcon}>✎</Text>
          </Pressable>
        </View>

        {/* About Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>App Version</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Build</Text>
              <Text style={styles.settingValue}>Preview APK</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Voxel Mobile</Text>
        <Text style={styles.subtitle}>Professional ASR & Navigation</Text>

        <View style={styles.row}>
          <Pressable
            onPress={() => setLanguage("en")}
            style={[styles.pill, language === "en" && styles.pillActive]}
          >
            <Text style={[styles.pillText, language === "en" && styles.pillTextActive]}>English</Text>
          </Pressable>
          <Pressable
            onPress={() => setLanguage("lg")}
            style={[styles.pill, language === "lg" && styles.pillActive]}
          >
            <Text style={[styles.pillText, language === "lg" && styles.pillTextActive]}>Luganda</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          {[
            ["home", "Home"],
            ["voice", "Voice"],
            ["navigate", "Navigate"],
            ["tts", "TTS"],
            ["profile", "Profile"],
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key as Tab)} style={[styles.tabBtn, tab === key && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === key && styles.tabBtnTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {tab === "home" && renderHome()}
        {tab === "voice" && renderVoice()}
        {tab === "navigate" && renderNavigate()}
        {tab === "tts" && renderTTS()}
        {tab === "profile" && renderProfile()}
      </ScrollView>

      {/* Map Modal */}
      <MapModal route={currentRoute} visible={mapModalVisible} onClose={() => setMapModalVisible(false)} />

      {/* Preference Pickers */}
      <PickerModal
        visible={editingPref === "language"}
        onClose={() => setEditingPref(null)}
        title="Select Language"
        options={["en", "lg"]}
        value={language}
        onChange={(val) => setLanguage(val as Language)}
      />
      <PickerModal
        visible={editingPref === "voice"}
        onClose={() => setEditingPref(null)}
        title="Select Voice"
        options={["female", "male", "robot"]}
        value={voice}
        onChange={(val) => setVoice(val as VoiceGender)}
      />
      <PickerModal
        visible={editingPref === "pitch"}
        onClose={() => setEditingPref(null)}
        title="Select Pitch"
        options={["0.3", "0.5", "0.7", "1.0"]}
        value={pitch}
        onChange={setPitch}
      />
      <PickerModal
        visible={editingPref === "rate"}
        onClose={() => setEditingPref(null)}
        title="Select Speech Rate"
        options={["0.5", "0.75", "1.0", "1.25", "1.5"]}
        value={rate}
        onChange={setRate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#081019",
  },
  container: {
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e5f7f5",
  },
  subtitle: {
    fontSize: 14,
    color: "#95a3b8",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: "#d4def0",
    fontWeight: "800",
    fontSize: 18,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#0e1724",
    borderWidth: 1,
    borderColor: "#243449",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#d4def0",
    minHeight: 90,
    textAlignVertical: "top",
  },
  homeGrid: {
    gap: 10,
  },
  homeCard: {
    backgroundColor: "#0e1724",
    borderWidth: 1,
    borderColor: "#243449",
    borderRadius: 12,
    padding: 12,
  },
  homeCardTitle: {
    color: "#d4def0",
    fontWeight: "700",
    fontSize: 15,
  },
  homeCardSub: {
    color: "#95a3b8",
    marginTop: 4,
    fontSize: 12,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  tabBtn: {
    backgroundColor: "#101a28",
    borderColor: "#2a3b52",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabBtnActive: {
    backgroundColor: "#0f2b31",
    borderColor: "#14b8a6",
  },
  tabBtnText: {
    color: "#95a3b8",
    fontWeight: "700",
    fontSize: 12,
  },
  tabBtnTextActive: {
    color: "#bdf4ed",
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2a3b52",
    backgroundColor: "#101a28",
  },
  pillActive: {
    borderColor: "#14b8a6",
    backgroundColor: "#0f2b31",
  },
  pillText: {
    color: "#95a3b8",
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#bdf4ed",
  },
  mainButton: {
    marginTop: 8,
    backgroundColor: "#14b8a6",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  mainButtonRecording: {
    backgroundColor: "#ef4444",
  },
  mainButtonText: {
    color: "#05131a",
    fontWeight: "800",
    fontSize: 16,
  },
  processingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  processingText: {
    color: "#95a3b8",
  },
  error: {
    color: "#fca5a5",
    backgroundColor: "#3a1111",
    padding: 10,
    borderRadius: 10,
  },
  card: {
    backgroundColor: "#0e1724",
    borderWidth: 1,
    borderColor: "#243449",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: "#d3ebf0",
    fontWeight: "800",
    marginBottom: 8,
    fontSize: 16,
  },
  label: {
    color: "#7f95b5",
    marginTop: 6,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    color: "#d4def0",
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: "#1e2d44",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: "#c8d5eb",
    fontWeight: "700",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#14b8a6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconText: {
    fontSize: 24,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: "#d4def0",
    fontWeight: "700",
    fontSize: 16,
  },
  profileEmail: {
    color: "#95a3b8",
    fontSize: 13,
    marginTop: 2,
  },
  settingRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a2d38",
  },
  settingLabel: {
    color: "#7f95b5",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  settingValue: {
    color: "#d4def0",
    fontSize: 14,
    fontWeight: "500",
  },
  editableOption: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a2d38",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editIcon: {
    color: "#14b8a6",
    fontSize: 18,
    fontWeight: "600",
  },
  mapCard: {
    backgroundColor: "#0e1724",
    borderWidth: 2,
    borderColor: "#14b8a6",
    borderRadius: 16,
    overflow: "hidden",
    gap: 0,
  },
  mapContainer: {
    backgroundColor: "#1a2d38",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
    borderBottomWidth: 1,
    borderBottomColor: "#14b8a6",
  },
  mapMarker: {
    fontSize: 48,
    marginBottom: 8,
  },
  mapDestination: {
    color: "#14b8a6",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  locationDetails: {
    padding: 16,
    gap: 12,
  },
  detailRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#243449",
  },
  detailLabel: {
    color: "#7f95b5",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    color: "#d4def0",
    fontSize: 13,
    fontWeight: "500",
  },
  actionButton: {
    backgroundColor: "#14b8a6",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 4,
  },
  actionButtonText: {
    color: "#081019",
    fontWeight: "800",
    fontSize: 15,
  },
  mapModal: {
    flex: 1,
    backgroundColor: "#081019",
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0e1724",
    borderBottomWidth: 1,
    borderBottomColor: "#243449",
  },
  mapTitle: {
    color: "#d4def0",
    fontWeight: "700",
    fontSize: 16,
  },
  mapCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  mapCloseText: {
    color: "#14b8a6",
    fontSize: 24,
    fontWeight: "600",
  },
  mapWebView: {
    flex: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    backgroundColor: "#0e1724",
    borderTopWidth: 1,
    borderTopColor: "#243449",
    maxHeight: "80%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#243449",
  },
  pickerTitle: {
    color: "#d4def0",
    fontWeight: "700",
    fontSize: 16,
  },
  pickerClose: {
    color: "#14b8a6",
    fontWeight: "700",
    fontSize: 14,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#243449",
  },
  pickerOptionSelected: {
    backgroundColor: "#1a2d38",
    borderLeftWidth: 3,
    borderLeftColor: "#14b8a6",
  },
  pickerOptionText: {
    color: "#95a3b8",
    fontSize: 14,
  },
  pickerOptionTextSelected: {
    color: "#14b8a6",
    fontWeight: "700",
  },
});
