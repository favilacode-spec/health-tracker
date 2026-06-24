import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const FOOD_CATEGORIES = [
  '🥩 Proteínas', '🥦 Verduras', '🍎 Frutas', '🌾 Cereales',
  '🥛 Lácteos', '🫒 Grasas saludables', '🥜 Legumbres',
  '🧃 Bebidas', '🧂 Condimentos', '🛒 General',
]

const RECOMMENDED_FOODS = [
  // Proteínas animales
  { name: 'Pechuga de pollo', cat: '🥩 Proteínas', protein: '31g/100g', note: 'Fuente principal de proteína magra. Muy versátil.' },
  { name: 'Muslo de pollo s/piel', cat: '🥩 Proteínas', protein: '25g/100g', note: 'Más sabroso que la pechuga, muy tierno.' },
  { name: 'Salmón', cat: '🥩 Proteínas', protein: '25g/100g', note: 'Proteína + omega-3 antiinflamatorio. Ideal 2×/semana.' },
  { name: 'Atún al agua (lata)', cat: '🥩 Proteínas', protein: '29g/100g', note: 'Proteína rápida sin refrigeración. Práctico.' },
  { name: 'Carne picada magra (<10%)', cat: '🥩 Proteínas', protein: '26g/100g', note: 'Versátil. Elegir cortes magros.' },
  { name: 'Lomo de cerdo', cat: '🥩 Proteínas', protein: '28g/100g', note: 'Corte magro, buena alternativa al pollo.' },
  { name: 'Merluza / Tilapia', cat: '🥩 Proteínas', protein: '22g/100g', note: 'Pescado blanco bajo en grasa, digestivo.' },
  { name: 'Camarones', cat: '🥩 Proteínas', protein: '24g/100g', note: 'Muy bajo en calorías, saciante.' },
  { name: 'Huevos', cat: '🥩 Proteínas', protein: '13g/100g', note: '6g proteína por huevo. Los más completos nutritivamente.' },
  { name: 'Claras de huevo', cat: '🥩 Proteínas', protein: '11g/100g', note: 'Proteína pura, sin grasa. Ideal para omelettes.' },
  { name: 'Pavo molido', cat: '🥩 Proteínas', protein: '27g/100g', note: 'Alternativa magra a la carne de res.' },
  // Lácteos
  { name: 'Yogur griego (0%)', cat: '🥛 Lácteos', protein: '10g/100g', note: 'Proteína + probióticos. Sin azúcar agregada.' },
  { name: 'Queso cottage', cat: '🥛 Lácteos', protein: '11g/100g', note: 'Bajo en calorías, alto en proteína. Saciante.' },
  { name: 'Ricotta descremada', cat: '🥛 Lácteos', protein: '11g/100g', note: 'Suave, ideal para desayunos y salsas.' },
  { name: 'Leche descremada', cat: '🥛 Lácteos', protein: '3.5g/100ml', note: 'Calcio + proteína, bajo en grasa.' },
  { name: 'Queso mozzarella light', cat: '🥛 Lácteos', protein: '22g/100g', note: 'Para ensaladas o platos calientes.' },
  // Verduras
  { name: 'Brócoli', cat: '🥦 Verduras', protein: '3g/100g', note: 'Alto en fibra. Ideal vapor o salteado.' },
  { name: 'Espinaca', cat: '🥦 Verduras', protein: '3g/100g', note: 'Hierro, magnesio, fibra. Perfecto en batidos.' },
  { name: 'Kale', cat: '🥦 Verduras', protein: '4g/100g', note: 'Súper verdura, antiinflamatoria.' },
  { name: 'Zucchini / Zapallito', cat: '🥦 Verduras', protein: '1g/100g', note: 'Muy bajo en calorías. Gran volumen.' },
  { name: 'Lechuga romana', cat: '🥦 Verduras', protein: '1g/100g', note: 'Base para ensaladas, muy hidratante.' },
  { name: 'Tomate cherry', cat: '🥦 Verduras', protein: '0.9g/100g', note: 'Antioxidantes, bajo en calorías.' },
  { name: 'Pepino', cat: '🥦 Verduras', protein: '0.7g/100g', note: 'Hidratación, muy pocas calorías.' },
  { name: 'Morrón / Pimiento', cat: '🥦 Verduras', protein: '1g/100g', note: 'Vitamina C, antioxidantes. Comer crudo o asado.' },
  { name: 'Coliflor', cat: '🥦 Verduras', protein: '2g/100g', note: 'Versátil: arroz de coliflor, purés. Bajo en carbos.' },
  { name: 'Champiñones', cat: '🥦 Verduras', protein: '3g/100g', note: 'Umami, bajo en calorías. Excelente en saltados.' },
  { name: 'Espárragos', cat: '🥦 Verduras', protein: '2g/100g', note: 'Diurético, alto en folatos.' },
  { name: 'Repollo / Col', cat: '🥦 Verduras', protein: '1.5g/100g', note: 'Económico, buena fibra. Ensaladas o rehogado.' },
  // Cereales
  { name: 'Avena', cat: '🌾 Cereales', protein: '17g/100g', note: 'Fibra soluble, reduce náuseas matutinas.' },
  { name: 'Arroz integral', cat: '🌾 Cereales', protein: '2.5g/100g', note: 'Carbohidrato complejo. Porciones moderadas.' },
  { name: 'Quinoa', cat: '🌾 Cereales', protein: '4.4g/100g cocida', note: 'Proteína completa. Sin gluten.' },
  { name: 'Pan de proteína / Ezekiel', cat: '🌾 Cereales', protein: '5-8g/rebanada', note: 'Base nutritiva para tostadas o sandwiches.' },
  // Grasas saludables
  { name: 'Palta / Aguacate', cat: '🫒 Grasas saludables', protein: '2g/100g', note: 'Grasas mono, saciedad, potasio.' },
  { name: 'Aceite de oliva EVOO', cat: '🫒 Grasas saludables', protein: '0', note: 'Para cocinar suave o aderezar. No freír fuerte.' },
  { name: 'Nueces', cat: '🫒 Grasas saludables', protein: '15g/100g', note: 'Omega-3, antioxidantes. Porciones de 30g.' },
  { name: 'Almendras', cat: '🥜 Legumbres', protein: '21g/100g', note: 'Snack nutritivo. 20-25 unidades = 1 porción.' },
  { name: 'Semillas de chía', cat: '🫒 Grasas saludables', protein: '17g/100g', note: 'Omega-3, fibra. 2 cdas en yogur o licuados.' },
  { name: 'Semillas de lino', cat: '🫒 Grasas saludables', protein: '18g/100g', note: 'Moler para aprovechar. Estreñimiento y omega-3.' },
  // Legumbres
  { name: 'Lentejas', cat: '🥜 Legumbres', protein: '9g/100g cocida', note: 'Proteína vegetal + hierro + fibra.' },
  { name: 'Garbanzos', cat: '🥜 Legumbres', protein: '9g/100g cocido', note: 'Saciantes, versátiles. Hummus o ensalada.' },
  { name: 'Porotos negros', cat: '🥜 Legumbres', protein: '9g/100g cocido', note: 'Fibra + proteína vegetal.' },
  // Frutas
  { name: 'Berries (frutillas, arándanos)', cat: '🍎 Frutas', protein: '1g/100g', note: 'Antioxidantes, bajo índice glucémico.' },
  { name: 'Manzana verde', cat: '🍎 Frutas', protein: '0.3g/100g', note: 'Fibra, bajo en azúcar. Snack saciante.' },
  { name: 'Banana (porción moderada)', cat: '🍎 Frutas', protein: '1.1g/100g', note: 'Post-entreno, potasio. Porciones pequeñas.' },
  // Bebidas
  { name: 'Agua mineral / filtrada', cat: '🧃 Bebidas', protein: '0', note: 'Mínimo 2.5L/día con tirzepatida.' },
  { name: 'Té verde / matcha', cat: '🧃 Bebidas', protein: '0', note: 'Antioxidantes, metabolismo. Sin azúcar.' },
  { name: 'Café (sin azúcar)', cat: '🧃 Bebidas', protein: '0', note: 'Con moderación. Puede reducir apetito.' },
  { name: 'Caldo de pollo casero', cat: '🧃 Bebidas', protein: '2-5g/taza', note: 'Ideal para náuseas. Hidrata y nutre.' },
  // Condimentos
  { name: 'Limón / Lima', cat: '🧂 Condimentos', protein: '0', note: 'Realza sabores sin calorías. Vitamina C.' },
  { name: 'Jengibre fresco', cat: '🧂 Condimentos', protein: '0', note: 'Antiinflamatorio, reduce náuseas con tirzepatida.' },
  { name: 'Cúrcuma', cat: '🧂 Condimentos', protein: '0', note: 'Antiinflamatoria. Agregar pimienta negra para absorción.' },
  { name: 'Ajo', cat: '🧂 Condimentos', protein: '0', note: 'Antibacterial, antiinflamatorio. Potencia sabores.' },
]

const RECIPES = [
  {
    name: 'Bowl de pollo con vegetales',
    emoji: '🥗', time: '25 min', protein: '~45g',
    desc: 'Plato completo, alto en proteína y bajo en calorías. Ideal para almuerzo.',
    ingredients: ['200g pechuga de pollo', '1 taza arroz integral cocido', '1 taza brócoli al vapor', '½ palta', '1 cdita aceite de oliva', 'Sal, limón, ajo en polvo'],
    steps: ['Sazonar el pollo con sal, ajo y limón.', 'Cocinar a la plancha 6-7 min por lado.', 'Cortar en tiritas y armar el bowl con el arroz, brócoli y palta en rodajas.', 'Rociar con aceite de oliva y limón. ¡Listo!'],
  },
  {
    name: 'Omelette de claras con espinaca',
    emoji: '🍳', time: '10 min', protein: '~30g',
    desc: 'Desayuno proteico rápido, digestivo y saciante.',
    ingredients: ['5 claras de huevo (o 2 huevos + 3 claras)', '1 taza espinaca fresca', '½ tomate cherry', '1 cdita aceite de oliva o spray', 'Sal y pimienta'],
    steps: ['Batir las claras con sal.', 'Calentar sartén antiadherente con un poco de aceite.', 'Volcar las claras y dejar cuajar 1 min.', 'Añadir espinaca y tomate en la mitad, doblar y cocinar 1 min más.'],
  },
  {
    name: 'Salmón al limón con espárragos',
    emoji: '🐟', time: '20 min', protein: '~38g',
    desc: 'Rico en omega-3 y proteína. Digestivo, ideal para la noche.',
    ingredients: ['200g filet de salmón', '8 espárragos', '1 limón', '1 cdita aceite de oliva', 'Sal, eneldo o perejil'],
    steps: ['Precalentar horno a 180°C.', 'Colocar salmón en bandeja con papel vegetal. Salpimentar y exprimir limón.', 'Agregar espárragos al costado con un chorrito de aceite.', 'Hornear 15 min o hasta que el salmón se desmenuce fácilmente.'],
  },
  {
    name: 'Avena proteica overnight',
    emoji: '🌾', time: '5 min (+ reposo nocturno)', protein: '~25g',
    desc: 'Prepará la noche anterior. Desayuno anti-náuseas y muy completo.',
    ingredients: ['½ taza avena arrollada', '1 taza yogur griego (0%)', '1 cda semillas de chía', '½ banana', '1 puñado de frutillas', 'Canela a gusto'],
    steps: ['Mezclar avena + yogur + chía en un frasco con tapa.', 'Agregar canela y revolver bien.', 'Refrigerar toda la noche.', 'A la mañana agregar la fruta fresca por arriba y consumir frío.'],
  },
  {
    name: 'Ensalada César con pollo',
    emoji: '🥙', time: '15 min', protein: '~40g',
    desc: 'Versión saludable del clásico. Alta en proteína, sin salsas pesadas.',
    ingredients: ['200g pechuga de pollo cocida', '3 hojas lechuga romana', '2 cdas queso rallado (parmesano light)', '1 cda aceite de oliva', 'Limón, ajo, mostaza (para el aderezo)', 'Crutones opcionales (poca cantidad)'],
    steps: ['Cortar el pollo en tiras y la lechuga en trozos grandes.', 'Batir aceite de oliva, limón, ajo picado y mostaza para el aderezo.', 'Mezclar todo y espolvorear con parmesano.'],
  },
  {
    name: 'Hamburguesas de pavo al horno',
    emoji: '🍔', time: '30 min', protein: '~35g',
    desc: 'Mucho más sabroso de lo que parece. Sin aceite, al horno.',
    ingredients: ['300g pavo molido', '1 huevo', '2 cdas avena (ligante)', '1 cdita ajo en polvo', '1 cdita cebolla deshidratada', 'Sal, pimienta, perejil'],
    steps: ['Mezclar todos los ingredientes en un bowl.', 'Formar 3-4 medallones y poner en bandeja con papel vegetal.', 'Horno a 180°C por 20-22 min dando vuelta a mitad de cocción.', 'Servir con hojas de lechuga en vez de pan o con pan integral.'],
  },
  {
    name: 'Smoothie proteico de berries',
    emoji: '🥤', time: '5 min', protein: '~22g',
    desc: 'Ideal para días con náuseas o poco apetito. Frío, suave y nutritivo.',
    ingredients: ['1 taza yogur griego (0%)', '½ taza leche descremada', '1 taza berries congeladas (frutillas/arándanos)', '1 cda semillas de chía', '½ banana', 'Hielo a gusto'],
    steps: ['Poner todos los ingredientes en la licuadora.', 'Procesar hasta obtener una textura suave y homogénea.', 'Consumir frío de inmediato. Podés agregar proteína en polvo si querés.'],
  },
  {
    name: 'Lentejas con vegetales',
    emoji: '🫘', time: '35 min', protein: '~18g/porción',
    desc: 'Proteína vegetal, fibra y hierro en un plato caliente y reconfortante.',
    ingredients: ['1 taza lentejas (remojadas)', '1 zanahoria', '1 morrón rojo', '1 cebolla', '2 dientes ajo', '1 tomate', 'Cúrcuma, comino, sal, aceite de oliva'],
    steps: ['Rehogar cebolla y ajo en aceite. Agregar zanahoria y morrón en cubitos.', 'Añadir lentejas escurridas, tomate picado y especias.', 'Cubrir con agua o caldo, hervir 20-25 min hasta tiernas.', 'Ajustar sal y servir. Se conserva 3 días en heladera.'],
  },
  {
    name: 'Wraps de lechuga con pollo y palta',
    emoji: '🌮', time: '15 min', protein: '~35g',
    desc: 'Sin carbohidratos refinados. Perfectos si el apetito es reducido.',
    ingredients: ['150g pollo cocido desmenuzado', '4 hojas grandes de lechuga romana', '½ palta en rodajas', '1 tomate en cubitos', 'Limón, sal, cilantro o perejil'],
    steps: ['Preparar el pollo desmenuzado sazonado con limón y sal.', 'Extender las hojas de lechuga como base.', 'Colocar el pollo, palta y tomate en el centro.', 'Enrollar y comer de inmediato.'],
  },
  {
    name: 'Pudín de chía con coco',
    emoji: '🫙', time: '5 min (+ 4h reposo)', protein: '~12g',
    desc: 'Postre o desayuno. Antiinflamatorio, fibra y saciante.',
    ingredients: ['3 cdas semillas de chía', '1 taza leche de coco light', '1 cdita extracto de vainilla', 'Stevia o endulzante', 'Berries y canela para servir'],
    steps: ['Mezclar chía con leche de coco, vainilla y endulzante.', 'Revolver bien y dejar reposar 10 min.', 'Revolver nuevamente y refrigerar 4h mínimo (o toda la noche).', 'Servir con berries frescas y canela.'],
  },
  {
    name: 'Caldo de pollo reconstituyente',
    emoji: '🍲', time: '45 min', protein: '~8g/taza',
    desc: 'El mejor aliado para días difíciles con náuseas. Hidrata y nutre suavemente.',
    ingredients: ['500g huesos de pollo o carcasa', '1 cebolla', '2 zanahorias', '2 ramas de apio', '1 puerro', 'Sal, pimienta en grano, laurel, perejil'],
    steps: ['Hervir todos los ingredientes en 2L de agua.', 'Cocinar a fuego bajo 40 min, espumando la superficie.', 'Colar el caldo y descartar los sólidos.', 'Tomar caliente a sorbos pequeños. Refrigerar hasta 4 días.'],
  },
  {
    name: 'Tortilla española con claras',
    emoji: '🥚', time: '20 min', protein: '~28g',
    desc: 'Versión ligera de la tortilla clásica. Excelente opción para almuerzo o cena.',
    ingredients: ['4 claras + 2 huevos enteros', '2 papas medianas', '½ cebolla', 'Aceite de oliva en spray', 'Sal y perejil'],
    steps: ['Cortar papas en rodajas finas y cocinar en sartén con spray, tapado, hasta tiernas.', 'Retirar papas, rehogar cebolla en la misma sartén.', 'Batir claras y huevos con sal. Mezclar con papas y cebolla.', 'Volcar a sartén caliente, cocinar tapado a fuego bajo 5 min, dar vuelta con un plato y cocinar 3 min más.'],
  },
]

const NUTRITION_TIPS = [
  { icon: '🥩', title: 'Priorizar proteína siempre', text: 'Apuntá a 1.2–1.6g por kg de peso corporal. La proteína preserva músculo durante la pérdida de peso y genera saciedad duradera.' },
  { icon: '🍽️', title: 'Comidas pequeñas y frecuentes', text: 'La tirzepatida reduce el apetito significativamente. 3–4 comidas pequeñas son más manejables que 2 grandes.' },
  { icon: '🥦', title: 'Vegetales en cada comida', text: 'Aportan fibra, vitaminas y volumen con muy pocas calorías. Cruciales para el tránsito intestinal con tirzepatida.' },
  { icon: '💧', title: 'Hidratación constante', text: 'Tomá agua entre comidas, no durante. Mínimo 2.5L/día. Reduce náuseas y ayuda a eliminar toxinas.' },
  { icon: '🚫', title: 'Evitar grasas pesadas y fritos', text: 'Empeoran las náuseas. Preferí vapor, horno, plancha o airfryer.' },
  { icon: '🍬', title: 'Eliminar azúcares simples', text: 'Refrescos, dulces y harinas blancas interfieren con la pérdida de peso y potencian las náuseas iniciales.' },
  { icon: '⏰', title: 'Horarios regulares', text: 'Comer siempre a la misma hora estabiliza el apetito residual y mejora el metabolismo.' },
  { icon: '🧃', title: 'Evitar alcohol completamente', text: 'Calorías vacías + interacción negativa con el tratamiento. El alcohol baja inhibiciones dietéticas también.' },
  { icon: '🫚', title: 'El día de la inyección', text: 'Optar por comidas muy livianas y digestivas. Caldos, gelatinas, yogur y frutas suaves. Evitar grasas.' },
  { icon: '🌡️', title: 'Temperatura de los alimentos', text: 'Los alimentos fríos o tibios suelen tolerarse mejor que los muy calientes los días post-inyección.' },
]

export default function Alimentacion() {
  const { user } = useAuth()
  const [tab, setTab] = useState('lista')
  const [lists, setLists] = useState([])
  const [activeList, setActiveList] = useState(null)
  const [items, setItems] = useState([])
  const [newListName, setNewListName] = useState('')
  const [newItem, setNewItem] = useState({ name: '', quantity: '', category: FOOD_CATEGORIES[9] })
  const [filterCat, setFilterCat] = useState('Todas')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [expandedRecipe, setExpandedRecipe] = useState(null)
  const [shareMsg, setShareMsg] = useState('')

  useEffect(() => { loadLists() }, [user])
  useEffect(() => { if (activeList) loadItems(activeList.id) }, [activeList])

  async function loadLists() {
    const { data } = await supabase.from('shopping_lists').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    setLists(data || [])
    if (data?.length > 0 && !activeList) setActiveList(data[0])
  }

  async function loadItems(listId) {
    const { data } = await supabase.from('shopping_items').select('*')
      .eq('list_id', listId).order('category').order('created_at')
    setItems(data || [])
  }

  function showMsg(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000) }

  async function createList() {
    if (!newListName.trim()) return
    const { data, error } = await supabase.from('shopping_lists').insert({
      user_id: user.id, name: newListName.trim(),
    }).select().single()
    if (!error) { setNewListName(''); setActiveList(data); loadLists() }
  }

  async function deleteList(id) {
    await supabase.from('shopping_lists').delete().eq('id', id)
    setActiveList(null); loadLists()
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.name.trim() || !activeList) return
    await supabase.from('shopping_items').insert({
      user_id: user.id, list_id: activeList.id,
      name: newItem.name.trim(), quantity: newItem.quantity, category: newItem.category,
    })
    setNewItem(i => ({ ...i, name: '', quantity: '' }))
    loadItems(activeList.id)
  }

  async function toggleItem(id, checked) {
    await supabase.from('shopping_items').update({ is_checked: !checked }).eq('id', id)
    loadItems(activeList.id)
  }

  async function deleteItem(id) {
    await supabase.from('shopping_items').delete().eq('id', id)
    loadItems(activeList.id)
  }

  async function addRecommended(food) {
    if (!activeList) { showMsg('error', 'Primero creá o seleccioná una lista'); return }
    await supabase.from('shopping_items').insert({
      user_id: user.id, list_id: activeList.id,
      name: food.name, category: food.cat,
    })
    showMsg('success', `✅ "${food.name}" agregado`)
    loadItems(activeList.id)
  }

  // Web Share API / clipboard
  async function shareList() {
    if (!activeList || items.length === 0) return
    const text = `📋 ${activeList.name}\n\n` +
      items.map(i => `${i.is_checked ? '✅' : '○'} ${i.name}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n')

    if (navigator.share) {
      try {
        await navigator.share({ title: activeList.name, text })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(text)
      setShareMsg('✅ Lista copiada al portapapeles')
      setTimeout(() => setShareMsg(''), 2500)
    } catch {
      setShareMsg('No se pudo copiar. Seleccioná la lista manualmente.')
      setTimeout(() => setShareMsg(''), 3000)
    }
  }

  const groupedItems = FOOD_CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})
  const uncheckedCount = items.filter(i => !i.is_checked).length
  const checkedCount   = items.filter(i => i.is_checked).length

  const S = ({ s }) => (
    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>{s}</div>
  )

  return (
    <div>
      <div className="page-header">
        <h1>🛒 Alimentación</h1>
        <p>Lista de compras, alimentos recomendados, recetas y consejos</p>
      </div>

      <div className="tabs-bar">
        {[
          ['lista', '🛒 Lista de compras'],
          ['recomendados', '⭐ Alimentos'],
          ['recetas', '👨‍🍳 Recetas'],
          ['consejos', '💡 Consejos'],
        ].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {/* ── LISTA ── */}
      {tab === 'lista' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">📋 Mis listas</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input type="text" placeholder="Nueva lista..." value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createList()}
                style={{ flex: 1 }} />
              <button className="btn-primary" onClick={createList}>Crear</button>
            </div>

            {lists.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No tenés listas aún.</p>
            ) : lists.map(list => (
              <div key={list.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 4, cursor: 'pointer',
                background: activeList?.id === list.id ? 'var(--primary-light)' : 'var(--bg-elevated)',
                border: `1.5px solid ${activeList?.id === list.id ? 'var(--primary)' : 'var(--border)'}`,
              }} onClick={() => setActiveList(list)}>
                <span style={{ fontWeight: activeList?.id === list.id ? 600 : 400, fontSize: 'var(--text-sm)', color: activeList?.id === list.id ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  {list.name}
                </span>
                <button className="btn-icon" onClick={e => { e.stopPropagation(); deleteList(list.id) }}>🗑️</button>
              </div>
            ))}

            {activeList && items.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button
                  onClick={shareList}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)', border: '1.5px solid var(--border-bright)',
                    color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  📱 Compartir lista (Notas / WhatsApp / Mail…)
                </button>
                {shareMsg && <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--secondary)', textAlign: 'center' }}>{shareMsg}</div>}
                <p style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                  En iPhone/Mac abre el menú para compartir con Apple Notes, Reminders, WhatsApp y más.
                </p>
              </div>
            )}
          </div>

          <div className="card">
            {!activeList ? (
              <div className="empty-state"><div className="empty-state-icon">🛒</div><p>Seleccioná o creá una lista.</p></div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div className="card-title" style={{ marginBottom: 0 }}>🛒 {activeList.name}</div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {uncheckedCount} pendientes · {checkedCount} listos
                  </span>
                </div>

                <form onSubmit={addItem} style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Agregar ítem..." value={newItem.name}
                    onChange={e => setNewItem(i => ({ ...i, name: e.target.value }))} required
                    style={{ flex: 2, minWidth: 130 }} />
                  <input type="text" placeholder="Cantidad" value={newItem.quantity}
                    onChange={e => setNewItem(i => ({ ...i, quantity: e.target.value }))}
                    style={{ flex: 1, minWidth: 70 }} />
                  <select value={newItem.category} onChange={e => setNewItem(i => ({ ...i, category: e.target.value }))}
                    style={{ flex: 1, minWidth: 110 }}>
                    {FOOD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button type="submit" className="btn-primary">+</button>
                </form>

                {items.length === 0 ? (
                  <div className="empty-state" style={{ padding: '28px 0' }}><p>La lista está vacía.</p></div>
                ) : (
                  Object.entries(groupedItems).map(([cat, catItems]) => (
                    <div key={cat} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{cat}</div>
                      {catItems.map(item => (
                        <div key={item.id} className="shopping-item">
                          <input type="checkbox" checked={item.is_checked} onChange={() => toggleItem(item.id, item.is_checked)} />
                          <span className={`shopping-item-name ${item.is_checked ? 'checked' : ''}`}>{item.name}</span>
                          {item.quantity && <span className="shopping-item-qty">{item.quantity}</span>}
                          <button className="btn-icon" style={{ padding: 4 }} onClick={() => deleteItem(item.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  ))
                )}

                {checkedCount > 0 && (
                  <button className="btn-secondary" style={{ marginTop: 8, fontSize: 'var(--text-xs)' }}
                    onClick={async () => {
                      await supabase.from('shopping_items').delete().eq('list_id', activeList.id).eq('is_checked', true)
                      loadItems(activeList.id)
                    }}>
                    🗑️ Limpiar marcados ({checkedCount})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── ALIMENTOS RECOMENDADOS ── */}
      {tab === 'recomendados' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {['Todas', ...FOOD_CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 600,
                  border: filterCat === cat ? '1.5px solid var(--primary)' : '1.5px solid var(--border-bright)',
                  background: filterCat === cat ? 'var(--primary-light)' : 'var(--bg-elevated)',
                  color: filterCat === cat ? 'var(--primary)' : 'var(--text-secondary)',
                }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 10 }}>
            {RECOMMENDED_FOODS.filter(f => filterCat === 'Todas' || f.cat === filterCat).map(food => (
              <div key={food.name} style={{
                padding: 14, borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{food.name}</div>
                    <span className="badge badge-gray" style={{ marginTop: 4 }}>{food.cat}</span>
                  </div>
                  {food.protein !== '0' && (
                    <span className="badge badge-success">🥩 {food.protein}</span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>{food.note}</div>
                <button onClick={() => addRecommended(food)}
                  style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600, padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--primary)',
                    color: 'var(--primary)', background: 'transparent', transition: 'all 0.15s', marginTop: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  + Agregar a mi lista
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECETAS ── */}
      {tab === 'recetas' && (
        <div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 20 }}>
            Recetas pensadas para personas en tratamiento con tirzepatida: altas en proteína, digestivas y fáciles de preparar.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {RECIPES.map((recipe, i) => (
              <div key={i} style={{
                borderRadius: 'var(--radius)',
                border: `1px solid ${expandedRecipe === i ? 'var(--primary)' : 'var(--border)'}`,
                background: 'var(--bg-card)',
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                {/* Header — siempre visible */}
                <button
                  style={{ width: '100%', padding: '14px 16px', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                  onClick={() => setExpandedRecipe(expandedRecipe === i ? null : i)}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{recipe.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: 4 }}>{recipe.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span className="badge badge-gray">⏱ {recipe.time}</span>
                      <span className="badge badge-success">🥩 {recipe.protein}</span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>{recipe.desc}</div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: 2, flexShrink: 0 }}>
                    {expandedRecipe === i ? '▲' : '▼'}
                  </span>
                </button>

                {/* Detalle expandible */}
                {expandedRecipe === i && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ paddingTop: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Ingredientes
                      </div>
                      <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {recipe.ingredients.map((ing, j) => (
                          <li key={j} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ing}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Preparación
                      </div>
                      <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {recipe.steps.map((step, j) => (
                          <li key={j} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <button
                      onClick={() => {
                        if (!activeList) { showMsg('error', 'Creá una lista primero en la pestaña "Lista"'); setTab('lista'); return }
                        recipe.ingredients.forEach(async (ing) => {
                          await supabase.from('shopping_items').insert({ user_id: user.id, list_id: activeList.id, name: ing, category: '🛒 General' })
                        })
                        showMsg('success', `✅ Ingredientes de "${recipe.name}" agregados a tu lista`)
                        if (activeList) loadItems(activeList.id)
                      }}
                      style={{
                        marginTop: 14, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)', fontWeight: 600,
                        border: '1.5px solid var(--primary)', color: 'var(--primary)', background: 'transparent',
                      }}>
                      🛒 Agregar ingredientes a mi lista
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONSEJOS ── */}
      {tab === 'consejos' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 28 }}>
            {NUTRITION_TIPS.map(tip => (
              <div key={tip.title} style={{
                padding: 18, borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: 'var(--bg-card)',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{tip.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6, color: 'var(--text-primary)' }}>{tip.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>{tip.text}</div>
              </div>
            ))}
          </div>

          {/* Plan sugerido */}
          <div className="card">
            <div className="card-title">📅 Plan de alimentación diario sugerido</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { meal: '🌅 Desayuno', items: ['Avena proteica overnight o huevos revueltos', 'Yogur griego con berries', 'Té verde o café sin azúcar'], protein: '~25g' },
                { meal: '☀️ Almuerzo', items: ['Proteína magra (200g pollo/salmón/carne magra)', 'Vegetales al vapor o salteados', 'Porción pequeña arroz integral o quinoa'], protein: '~40g' },
                { meal: '🍎 Merienda', items: ['Queso cottage o yogur griego', '20-25 almendras', 'Fruta de bajo índice glucémico'], protein: '~20g' },
                { meal: '🌙 Cena', items: ['Proteína magra o 3 huevos', 'Ensalada abundante o vegetales cocidos', 'Aceite de oliva y limón'], protein: '~35g' },
              ].map(plan => (
                <div key={plan.meal} style={{
                  padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                  borderTop: '3px solid var(--primary)',
                }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8, color: 'var(--text-primary)' }}>{plan.meal}</div>
                  <ul style={{ paddingLeft: 14, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 2 }}>
                    {plan.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--secondary)' }}>
                    Proteína: {plan.protein}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: 12, background: 'var(--secondary-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--secondary)', border: '1px solid rgba(38,217,160,0.2)' }}>
              <strong>💪 Meta proteica total:</strong> ~120g/día — ajustá según tu peso y objetivo con tu médico.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
