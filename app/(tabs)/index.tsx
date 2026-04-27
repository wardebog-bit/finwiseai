import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Alert, Modal,
} from "react-native";
import { createClient } from "@supabase/supabase-js";

// ✅ Reemplaza con tus credenciales de Supabase
const SUPABASE_URL = "https://ayktqybzvvvlxoyxsjko.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5a3RxeWJ6dnZ2bHhveXhzamtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjI2MDIsImV4cCI6MjA5Mjc5ODYwMn0.Jf0nZg8KJjpnD-5As5TRMubkcwZVlX9z1MpWDSbxPIk";
const API_URL = "https://finwiseai-backend-production.up.railway.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIAS_GASTO = ["🍔 Comida", "🚗 Transporte", "🏠 Vivienda", "💊 Salud", "🎮 Entretenimiento", "👕 Ropa", "📚 Educación", "💡 Servicios", "🛒 Mercado", "Otro"];
const CATEGORIAS_INGRESO = ["💼 Salario", "💰 Freelance", "🏦 Inversiones", "🎁 Regalo", "Otro"];

type Transaccion = { id: string; tipo: string; categoria: string; descripcion: string; monto: number; fecha: string };
type Meta = { id: string; nombre: string; monto_objetivo: number; monto_actual: number; fecha_limite: string };
type Presupuesto = { id: string; categoria: string; monto_limite: number; mes: number; anio: number };

export default function FinWiseAI() {
  const [pantalla, setPantalla] = useState<"login" | "home" | "transacciones" | "metas" | "presupuestos" | "ia">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [consejo, setConsejo] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);

  // Formulario transacción
  const [tipo, setTipo] = useState<"ingreso" | "gasto">("gasto");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  // Formulario meta
  const [metaNombre, setMetaNombre] = useState("");
  const [metaObjetivo, setMetaObjetivo] = useState("");
  const [metaFecha, setMetaFecha] = useState("");
  const [metaAporte, setMetaAporte] = useState("");
  const [metaSeleccionada, setMetaSeleccionada] = useState<string | null>(null);

  // Formulario presupuesto
  const [presCat, setPresCat] = useState("");
  const [presLimite, setPresLimite] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) { setUsuario(data.session.user); setPantalla("home"); cargarDatos(data.session.user.id); }
    });
  }, []);

  const cargarDatos = async (uid: string) => {
    const [t, m, p] = await Promise.all([
      supabase.from("transacciones").select("*").eq("user_id", uid).order("fecha", { ascending: false }),
      supabase.from("metas").select("*").eq("user_id", uid),
      supabase.from("presupuestos").select("*").eq("user_id", uid),
    ]);
    if (t.data) setTransacciones(t.data);
    if (m.data) setMetas(m.data);
    if (p.data) setPresupuestos(p.data);
  };

  const login = async () => {
    if (!email || !password) { Alert.alert("Error", "Completa todos los campos"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const { data: d2, error: e2 } = await supabase.auth.signUp({ email, password });
      if (e2) { Alert.alert("Error", e2.message); }
      else if (d2.user) { setUsuario(d2.user); setPantalla("home"); cargarDatos(d2.user.id); }
    } else if (data.user) { setUsuario(data.user); setPantalla("home"); cargarDatos(data.user.id); }
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUsuario(null); setPantalla("login");
  };

  const agregarTransaccion = async () => {
    if (!monto || !categoria) { Alert.alert("Error", "Completa monto y categoría"); return; }
    const { error } = await supabase.from("transacciones").insert({
      user_id: usuario.id, tipo, categoria, descripcion, monto: parseFloat(monto), fecha
    });
    if (!error) { cargarDatos(usuario.id); setModal(null); setMonto(""); setDescripcion(""); setCategoria(""); }
    else Alert.alert("Error", error.message);
  };

  const agregarMeta = async () => {
    if (!metaNombre || !metaObjetivo) { Alert.alert("Error", "Completa nombre y objetivo"); return; }
    const { error } = await supabase.from("metas").insert({
      user_id: usuario.id, nombre: metaNombre, monto_objetivo: parseFloat(metaObjetivo), monto_actual: 0, fecha_limite: metaFecha
    });
    if (!error) { cargarDatos(usuario.id); setModal(null); setMetaNombre(""); setMetaObjetivo(""); setMetaFecha(""); }
    else Alert.alert("Error", error.message);
  };

  const aportarMeta = async () => {
    if (!metaAporte || !metaSeleccionada) return;
    const meta = metas.find(m => m.id === metaSeleccionada);
    if (!meta) return;
    const nuevo = Math.min(meta.monto_actual + parseFloat(metaAporte), meta.monto_objetivo);
    await supabase.from("metas").update({ monto_actual: nuevo }).eq("id", metaSeleccionada);
    cargarDatos(usuario.id); setMetaAporte(""); setMetaSeleccionada(null); setModal(null);
  };

  const agregarPresupuesto = async () => {
    if (!presCat || !presLimite) { Alert.alert("Error", "Completa todos los campos"); return; }
    const hoy = new Date();
    const { error } = await supabase.from("presupuestos").insert({
      user_id: usuario.id, categoria: presCat, monto_limite: parseFloat(presLimite),
      mes: hoy.getMonth() + 1, anio: hoy.getFullYear()
    });
    if (!error) { cargarDatos(usuario.id); setModal(null); setPresCat(""); setPresLimite(""); }
    else Alert.alert("Error", error.message);
  };

  const pedirConsejo = async () => {
    setLoadingIA(true); setConsejo("");
    const totalIngresos = transacciones.filter(t => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0);
    const totalGastos = transacciones.filter(t => t.tipo === "gasto").reduce((s, t) => s + t.monto, 0);
    const balance = totalIngresos - totalGastos;
    const gastosPorCategoria = CATEGORIAS_GASTO.map(c => {
      const total = transacciones.filter(t => t.tipo === "gasto" && t.categoria === c).reduce((s, t) => s + t.monto, 0);
      return total > 0 ? `${c}: $${total.toLocaleString("es-CO")}` : null;
    }).filter(Boolean).join(", ");

    const prompt = `Eres un asesor financiero experto. El usuario tiene estos datos financieros:
- Ingresos totales: $${totalIngresos.toLocaleString("es-CO")} COP
- Gastos totales: $${totalGastos.toLocaleString("es-CO")} COP
- Balance: $${balance.toLocaleString("es-CO")} COP
- Gastos por categoría: ${gastosPorCategoria || "Sin registros"}
- Metas de ahorro: ${metas.map(m => `${m.nombre} (${Math.round(m.monto_actual/m.monto_objetivo*100)}%)`).join(", ") || "Sin metas"}

Da un análisis financiero personalizado en español con:
1. Evaluación del estado financiero actual
2. 3 consejos específicos y accionables para mejorar
3. Alerta si algún gasto es excesivo
4. Recomendación de ahorro mensual
Sé directo, práctico y motivador.`;

    try {
      const res = await fetch(`${API_URL}/generar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setConsejo(data.resultado || "No se pudo obtener consejo.");
    } catch { setConsejo("Error al conectar con la IA."); }
    setLoadingIA(false);
  };

  // Cálculos
  const totalIngresos = transacciones.filter(t => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0);
  const totalGastos = transacciones.filter(t => t.tipo === "gasto").reduce((s, t) => s + t.monto, 0);
  const balance = totalIngresos - totalGastos;

  const fmt = (n: number) => `$${n.toLocaleString("es-CO")} COP`;

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (pantalla === "login") return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <View style={s.loginHeader}>
        <View style={s.logoCircle}><Text style={s.logoEmoji}>💰</Text></View>
        <Text style={s.appTitle}>Fin<Text style={s.accent}>Wise</Text>AI</Text>
        <Text style={s.appSub}>Tu asesor financiero inteligente</Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>CORREO ELECTRÓNICO</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="tu@correo.com" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="email-address" autoCapitalize="none"/>
        <Text style={s.label}>CONTRASEÑA</Text>
        <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.25)" secureTextEntry/>
        <TouchableOpacity style={s.mainBtn} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff"/> : <Text style={s.mainBtnTxt}>Entrar / Registrarse</Text>}
        </TouchableOpacity>
        <Text style={[s.label, {textAlign:"center", marginTop:12}]}>Si no tienes cuenta se crea automáticamente</Text>
      </View>
    </ScrollView>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (pantalla === "home") return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <View style={s.topBar}>
        <View>
          <Text style={s.welcome}>Hola 👋</Text>
          <Text style={s.email}>{usuario?.email}</Text>
        </View>
        <TouchableOpacity onPress={logout}><Text style={s.logout}>Salir</Text></TouchableOpacity>
      </View>

      {/* Balance */}
      <View style={[s.card, s.balanceCard]}>
        <Text style={s.balanceLabel}>BALANCE TOTAL</Text>
        <Text style={[s.balanceNum, {color: balance >= 0 ? "#4ade80" : "#f87171"}]}>{fmt(balance)}</Text>
        <View style={s.balanceRow}>
          <View style={s.balanceItem}>
            <Text style={s.balanceItemLabel}>↑ Ingresos</Text>
            <Text style={[s.balanceItemNum, {color:"#4ade80"}]}>{fmt(totalIngresos)}</Text>
          </View>
          <View style={s.balanceSep}/>
          <View style={s.balanceItem}>
            <Text style={s.balanceItemLabel}>↓ Gastos</Text>
            <Text style={[s.balanceItemNum, {color:"#f87171"}]}>{fmt(totalGastos)}</Text>
          </View>
        </View>
      </View>

      {/* Menú */}
      <View style={s.menuGrid}>
        <TouchableOpacity style={s.menuCard} onPress={() => setPantalla("transacciones")}>
          <Text style={s.menuIcon}>💳</Text>
          <Text style={s.menuLabel}>Transacciones</Text>
          <Text style={s.menuSub}>{transacciones.length} registros</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuCard} onPress={() => setPantalla("metas")}>
          <Text style={s.menuIcon}>🎯</Text>
          <Text style={s.menuLabel}>Metas</Text>
          <Text style={s.menuSub}>{metas.length} activas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.menuCard} onPress={() => setPantalla("presupuestos")}>
          <Text style={s.menuIcon}>📊</Text>
          <Text style={s.menuLabel}>Presupuestos</Text>
          <Text style={s.menuSub}>{presupuestos.length} categorías</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.menuCard, s.menuCardIA]} onPress={() => setPantalla("ia")}>
          <Text style={s.menuIcon}>🤖</Text>
          <Text style={s.menuLabel}>Asesor IA</Text>
          <Text style={s.menuSub}>Consejos personalizados</Text>
        </TouchableOpacity>
      </View>

      {/* Últimas transacciones */}
      {transacciones.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Últimas transacciones</Text>
          {transacciones.slice(0, 5).map(t => (
            <View key={t.id} style={s.txRow}>
              <View style={s.txLeft}>
                <Text style={s.txCat}>{t.categoria}</Text>
                <Text style={s.txDesc}>{t.descripcion || t.fecha}</Text>
              </View>
              <Text style={[s.txMonto, {color: t.tipo === "ingreso" ? "#4ade80" : "#f87171"}]}>
                {t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // ── TRANSACCIONES ─────────────────────────────────────────────────────────
  if (pantalla === "transacciones") return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setPantalla("home")}><Text style={s.back}>← Inicio</Text></TouchableOpacity>
        <Text style={s.pageTitle}>Transacciones</Text>
        <TouchableOpacity onPress={() => setModal("tx")}><Text style={s.addBtn}>+ Añadir</Text></TouchableOpacity>
      </View>
      {transacciones.map(t => (
        <View key={t.id} style={s.card}>
          <View style={s.txRow}>
            <View style={s.txLeft}>
              <Text style={s.txCat}>{t.categoria}</Text>
              <Text style={s.txDesc}>{t.descripcion} · {t.fecha}</Text>
            </View>
            <Text style={[s.txMonto, {color: t.tipo === "ingreso" ? "#4ade80" : "#f87171"}]}>
              {t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}
            </Text>
          </View>
        </View>
      ))}
      {transacciones.length === 0 && <Text style={s.empty}>No hay transacciones aún. ¡Añade la primera!</Text>}

      {/* Modal añadir transacción */}
      <Modal visible={modal === "tx"} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nueva Transacción</Text>
            <View style={s.chips}>
              {["gasto","ingreso"].map(t => (
                <TouchableOpacity key={t} style={[s.chip, tipo === t && s.chipActive]} onPress={() => { setTipo(t as any); setCategoria(""); }}>
                  <Text style={[s.chipTxt, tipo === t && s.chipActiveTxt]}>{t === "gasto" ? "💸 Gasto" : "💰 Ingreso"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>CATEGORÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
              <View style={s.chips}>
                {(tipo === "gasto" ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO).map(c => (
                  <TouchableOpacity key={c} style={[s.chip, categoria === c && s.chipActive]} onPress={() => setCategoria(c)}>
                    <Text style={[s.chipTxt, categoria === c && s.chipActiveTxt]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.label}>MONTO (COP)</Text>
            <TextInput style={s.input} value={monto} onChangeText={setMonto} placeholder="Ej: 50000" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="numeric"/>
            <Text style={s.label}>DESCRIPCIÓN (opcional)</Text>
            <TextInput style={s.input} value={descripcion} onChangeText={setDescripcion} placeholder="Ej: Almuerzo en restaurante" placeholderTextColor="rgba(255,255,255,0.25)"/>
            <Text style={s.label}>FECHA</Text>
            <TextInput style={s.input} value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.25)"/>
            <TouchableOpacity style={s.mainBtn} onPress={agregarTransaccion}><Text style={s.mainBtnTxt}>Guardar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}><Text style={s.cancelTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  // ── METAS ─────────────────────────────────────────────────────────────────
  if (pantalla === "metas") return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setPantalla("home")}><Text style={s.back}>← Inicio</Text></TouchableOpacity>
        <Text style={s.pageTitle}>Metas de Ahorro</Text>
        <TouchableOpacity onPress={() => setModal("meta")}><Text style={s.addBtn}>+ Nueva</Text></TouchableOpacity>
      </View>
      {metas.map(m => {
        const pct = Math.min(Math.round(m.monto_actual / m.monto_objetivo * 100), 100);
        return (
          <View key={m.id} style={s.card}>
            <View style={{flexDirection:"row", justifyContent:"space-between", marginBottom:10}}>
              <Text style={s.cardTitle}>{m.nombre}</Text>
              <Text style={{color:"#4ade80", fontSize:14, fontWeight:"700"}}>{pct}%</Text>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, {width:`${pct}%`}]}/>
            </View>
            <View style={{flexDirection:"row", justifyContent:"space-between", marginTop:8}}>
              <Text style={s.txDesc}>{fmt(m.monto_actual)} ahorrado</Text>
              <Text style={s.txDesc}>Meta: {fmt(m.monto_objetivo)}</Text>
            </View>
            <TouchableOpacity style={[s.mainBtn, {marginTop:12}]} onPress={() => { setMetaSeleccionada(m.id); setModal("aporte"); }}>
              <Text style={s.mainBtnTxt}>+ Aportar</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      {metas.length === 0 && <Text style={s.empty}>No hay metas aún. ¡Crea tu primera meta de ahorro!</Text>}

      {/* Modal nueva meta */}
      <Modal visible={modal === "meta"} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nueva Meta</Text>
            <Text style={s.label}>NOMBRE</Text>
            <TextInput style={s.input} value={metaNombre} onChangeText={setMetaNombre} placeholder="Ej: Viaje a Cartagena" placeholderTextColor="rgba(255,255,255,0.25)"/>
            <Text style={s.label}>MONTO OBJETIVO (COP)</Text>
            <TextInput style={s.input} value={metaObjetivo} onChangeText={setMetaObjetivo} placeholder="Ej: 2000000" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="numeric"/>
            <Text style={s.label}>FECHA LÍMITE</Text>
            <TextInput style={s.input} value={metaFecha} onChangeText={setMetaFecha} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.25)"/>
            <TouchableOpacity style={s.mainBtn} onPress={agregarMeta}><Text style={s.mainBtnTxt}>Crear Meta</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}><Text style={s.cancelTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal aportar */}
      <Modal visible={modal === "aporte"} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Aportar a Meta</Text>
            <Text style={s.label}>MONTO A APORTAR (COP)</Text>
            <TextInput style={s.input} value={metaAporte} onChangeText={setMetaAporte} placeholder="Ej: 100000" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="numeric"/>
            <TouchableOpacity style={s.mainBtn} onPress={aportarMeta}><Text style={s.mainBtnTxt}>Aportar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}><Text style={s.cancelTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  // ── PRESUPUESTOS ──────────────────────────────────────────────────────────
  if (pantalla === "presupuestos") return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setPantalla("home")}><Text style={s.back}>← Inicio</Text></TouchableOpacity>
        <Text style={s.pageTitle}>Presupuestos</Text>
        <TouchableOpacity onPress={() => setModal("pres")}><Text style={s.addBtn}>+ Nuevo</Text></TouchableOpacity>
      </View>
      {presupuestos.map(p => {
        const gastado = transacciones.filter(t => t.tipo === "gasto" && t.categoria === p.categoria).reduce((s, t) => s + t.monto, 0);
        const pct = Math.min(Math.round(gastado / p.monto_limite * 100), 100);
        const alerta = pct >= 80;
        return (
          <View key={p.id} style={[s.card, alerta && s.cardAlerta]}>
            <View style={{flexDirection:"row", justifyContent:"space-between", marginBottom:10}}>
              <Text style={s.cardTitle}>{p.categoria}</Text>
              <Text style={{color: alerta ? "#f87171" : "#4ade80", fontSize:14, fontWeight:"700"}}>{pct}% {alerta ? "⚠️" : ""}</Text>
            </View>
            <View style={s.progressBg}>
              <View style={[s.progressFill, {width:`${pct}%`, backgroundColor: alerta ? "#f87171" : "#4ade80"}]}/>
            </View>
            <View style={{flexDirection:"row", justifyContent:"space-between", marginTop:8}}>
              <Text style={s.txDesc}>Gastado: {fmt(gastado)}</Text>
              <Text style={s.txDesc}>Límite: {fmt(p.monto_limite)}</Text>
            </View>
          </View>
        );
      })}
      {presupuestos.length === 0 && <Text style={s.empty}>No hay presupuestos. ¡Define límites por categoría!</Text>}

      <Modal visible={modal === "pres"} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nuevo Presupuesto</Text>
            <Text style={s.label}>CATEGORÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:16}}>
              <View style={s.chips}>
                {CATEGORIAS_GASTO.map(c => (
                  <TouchableOpacity key={c} style={[s.chip, presCat === c && s.chipActive]} onPress={() => setPresCat(c)}>
                    <Text style={[s.chipTxt, presCat === c && s.chipActiveTxt]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.label}>LÍMITE MENSUAL (COP)</Text>
            <TextInput style={s.input} value={presLimite} onChangeText={setPresLimite} placeholder="Ej: 500000" placeholderTextColor="rgba(255,255,255,0.25)" keyboardType="numeric"/>
            <TouchableOpacity style={s.mainBtn} onPress={agregarPresupuesto}><Text style={s.mainBtnTxt}>Guardar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(null)}><Text style={s.cancelTxt}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  // ── ASESOR IA ─────────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setPantalla("home")}><Text style={s.back}>← Inicio</Text></TouchableOpacity>
        <Text style={s.pageTitle}>Asesor IA</Text>
        <View style={{width:60}}/>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>🤖 Tu asesor financiero personal</Text>
        <Text style={s.txDesc}>Analiza tus datos financieros y te da consejos personalizados basados en tus ingresos, gastos y metas.</Text>
        <TouchableOpacity style={[s.mainBtn, {marginTop:20}]} onPress={pedirConsejo} disabled={loadingIA}>
          {loadingIA ? (
            <View style={{flexDirection:"row", alignItems:"center", gap:10}}>
              <ActivityIndicator color="#fff" size="small"/>
              <Text style={s.mainBtnTxt}>Analizando tus finanzas...</Text>
            </View>
          ) : <Text style={s.mainBtnTxt}>✦ Obtener consejo de IA</Text>}
        </TouchableOpacity>
      </View>
      {!!consejo && (
        <View style={s.card}>
          <Text style={s.cardTitle}>💡 Análisis y Consejos</Text>
          {consejo.split("\n").filter(Boolean).map((linea, i) => {
            const limpia = linea.replace(/^#{1,3}\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/^[-•]\s*/, "");
            const esBullet = linea.startsWith("-") || linea.startsWith("•");
            if (!limpia.trim()) return <View key={i} style={{height:8}}/>;
            return (
              <View key={i} style={esBullet ? s.bulletRow : {}}>
                {esBullet && <Text style={s.bulletIcon}>▸</Text>}
                <Text style={s.parrafo}>{limpia}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex:1, backgroundColor:"#080d1a" },
  container: { padding:20, paddingTop: Platform.OS === "android" ? 50 : 60, paddingBottom:40 },
  loginHeader: { alignItems:"center", marginBottom:32 },
  logoCircle: { width:80, height:80, borderRadius:24, backgroundColor:"rgba(74,222,128,0.1)", borderWidth:1, borderColor:"rgba(74,222,128,0.3)", alignItems:"center", justifyContent:"center", marginBottom:16 },
  logoEmoji: { fontSize:38 },
  appTitle: { fontSize:42, color:"#fff", fontWeight:"200", letterSpacing:6 },
  accent: { color:"#4ade80", fontWeight:"700" },
  appSub: { color:"rgba(255,255,255,0.35)", fontSize:14, marginTop:6, letterSpacing:1 },
  topBar: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:24 },
  welcome: { color:"#fff", fontSize:20, fontWeight:"700" },
  email: { color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:2 },
  logout: { color:"rgba(255,255,255,0.4)", fontSize:14 },
  back: { color:"#4ade80", fontSize:14, fontWeight:"600" },
  pageTitle: { color:"#fff", fontSize:18, fontWeight:"700" },
  addBtn: { color:"#4ade80", fontSize:14, fontWeight:"600" },
  card: { backgroundColor:"rgba(255,255,255,0.04)", borderWidth:1, borderColor:"rgba(255,255,255,0.08)", borderRadius:16, padding:20, marginBottom:16 },
  cardAlerta: { borderColor:"rgba(248,113,113,0.3)", backgroundColor:"rgba(248,113,113,0.05)" },
  balanceCard: { backgroundColor:"rgba(74,222,128,0.06)", borderColor:"rgba(74,222,128,0.2)", alignItems:"center" },
  balanceLabel: { color:"rgba(255,255,255,0.4)", fontSize:11, letterSpacing:2, marginBottom:8, fontFamily: Platform.OS === "android" ? "monospace" : "Courier" },
  balanceNum: { fontSize:36, fontWeight:"800", marginBottom:20 },
  balanceRow: { flexDirection:"row", width:"100%", alignItems:"center" },
  balanceItem: { flex:1, alignItems:"center" },
  balanceSep: { width:1, height:40, backgroundColor:"rgba(255,255,255,0.1)" },
  balanceItemLabel: { color:"rgba(255,255,255,0.4)", fontSize:12, marginBottom:4 },
  balanceItemNum: { fontSize:16, fontWeight:"700" },
  menuGrid: { flexDirection:"row", flexWrap:"wrap", gap:12, marginBottom:8 },
  menuCard: { width:"47%", backgroundColor:"rgba(255,255,255,0.04)", borderWidth:1, borderColor:"rgba(255,255,255,0.08)", borderRadius:16, padding:20 },
  menuCardIA: { borderColor:"rgba(74,222,128,0.2)", backgroundColor:"rgba(74,222,128,0.05)" },
  menuIcon: { fontSize:28, marginBottom:10 },
  menuLabel: { color:"#fff", fontSize:15, fontWeight:"600", marginBottom:4 },
  menuSub: { color:"rgba(255,255,255,0.4)", fontSize:12 },
  txRow: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingVertical:8, borderBottomWidth:1, borderBottomColor:"rgba(255,255,255,0.05)" },
  txLeft: { flex:1 },
  txCat: { color:"#fff", fontSize:14, fontWeight:"600" },
  txDesc: { color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:2 },
  txMonto: { fontSize:15, fontWeight:"700" },
  cardTitle: { color:"#fff", fontSize:16, fontWeight:"700", marginBottom:12 },
  label: { color:"rgba(255,255,255,0.4)", fontSize:11, letterSpacing:2, marginBottom:8, marginTop:12, fontFamily: Platform.OS === "android" ? "monospace" : "Courier" },
  input: { backgroundColor:"rgba(255,255,255,0.05)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)", borderRadius:10, padding:14, color:"#fff", fontSize:15 },
  chips: { flexDirection:"row", flexWrap:"wrap", gap:8 },
  chip: { backgroundColor:"rgba(255,255,255,0.04)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)", borderRadius:100, paddingHorizontal:14, paddingVertical:7 },
  chipActive: { backgroundColor:"rgba(74,222,128,0.15)", borderColor:"rgba(74,222,128,0.5)" },
  chipTxt: { color:"rgba(255,255,255,0.5)", fontSize:13 },
  chipActiveTxt: { color:"#4ade80" },
  mainBtn: { backgroundColor:"rgba(74,222,128,0.2)", borderWidth:1, borderColor:"rgba(74,222,128,0.4)", borderRadius:12, padding:16, alignItems:"center", marginTop:16 },
  mainBtnTxt: { color:"#4ade80", fontSize:15, fontWeight:"700" },
  cancelBtn: { borderWidth:1, borderColor:"rgba(255,255,255,0.1)", borderRadius:12, padding:12, alignItems:"center", marginTop:10 },
  cancelTxt: { color:"rgba(255,255,255,0.35)", fontSize:13 },
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.7)", justifyContent:"flex-end" },
  modalCard: { backgroundColor:"#111827", borderTopLeftRadius:24, borderTopRightRadius:24, padding:28, maxHeight:"85%" },
  modalTitle: { color:"#fff", fontSize:20, fontWeight:"700", marginBottom:8 },
  progressBg: { height:8, backgroundColor:"rgba(255,255,255,0.1)", borderRadius:4, overflow:"hidden" },
  progressFill: { height:8, backgroundColor:"#4ade80", borderRadius:4 },
  empty: { color:"rgba(255,255,255,0.3)", textAlign:"center", marginTop:40, fontSize:14 },
  bulletRow: { flexDirection:"row", gap:8, marginBottom:6, alignItems:"flex-start" },
  bulletIcon: { color:"#4ade80", fontSize:14, marginTop:3 },
  parrafo: { color:"rgba(255,255,255,0.8)", fontSize:14, lineHeight:22, flex:1, marginBottom:4 },
});
