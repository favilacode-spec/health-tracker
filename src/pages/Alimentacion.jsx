import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const FOOD_CATEGORIES = [
  '🥩 Proteínas', '🥦 Verduras', '🍎 Frutas', '🌾 Cereales',
  '🥛 Lácteos', '🫒 Grasas saludables', '🥜 Legumbres', '🧃 Bebidas', '🧂 Condimentos', '🛒 General'
]

const RECOMMENDED_FOODS = [
  { name: 'Pechuga de pollo', cat: '🥩 Proteínas', protein: '31g/100g', note: 'Fuente principal de proteína magra' },
  { name: 'Huevos', cat: '🥩 Proteínas', protein: '13g/100g', note: '6g proteína por huevo. Versátiles y económicos' },
  { name: 'Atún en lata (al agua)', cat: '🥩 Proteínas', protein: '29g/100g', note: 'Proteína rápida y sin refrigeración' },
  { name: 'Salmón', cat: '🥩 Proteínas', protein: '25g/100g', note: 'Proteína + omega-3 antiinflamatorio' },
  { name: 'Carne picada magra', cat: '🥩 Proteínas', protein: '26g/100g', note: 'Versátil, buscar <10% grasa' },
  { name: 'Queso cottage', cat: '🥛 Lácteos', protein: '11g/100g', note: 'Bajo en calorías, alto en proteína' },
  { name: 'Yogur griego natural', cat: '🥛 Lácteos', protein: '10g/100g', note: 'Proteína + probióticos. Sin azúcar agregada' },
  { name: 'Clara de huevo (líquida)', cat: '🥩 Proteínas', protein: '11g/100g', note: 'Proteína pura, sin grasa' },
  { name: 'Brócoli', cat: '🥦 Verduras', protein: '3g/100g', note: 'Alto en fibra, ideal para saciedad' },
  { name: 'Espinaca', cat: '🥦 Verduras', protein: '3g/100g', note: 'Hierro y fibra. Ideal en batidos o salteados' },
  { name: 'Zucchini', cat: '🥦 Verduras', protein: '1g/100g', note: 'Muy bajo en calorías, llena mucho' },
  { name: 'Lentejas', cat: '🥜 Legumbres', protein: '9g/100g', note: 'Proteína vegetal + fibra' },
  { name: 'Arroz integral', cat: '🌾 Cereales', protein: '2.5g/100g', note: 'Carbohidrato complejo, en porciones moderadas' },
  { name: 'Avena', cat: '🌾 Cereales', protein: '17g/100g', note: 'Fibra que ayuda a controlar náuseas matutinas' },
  { name: 'Palta / Aguacate', cat: '🫒 Grasas saludables', protein: '2g/100g', note: 'Grasas buenas + saciedad' },
  { name: 'Aceite de oliva extra virgen', cat: '🫒 Grasas saludables', protein: '0', note: 'Solo para cocinar/aderezar' },
  { name: 'Almendras', cat: '🥜 Legumbres', protein: '21g/100g', note: 'Snack nutritivo. Porciones pequeñas' },
]

const NUTRITION_TIPS = [
  { icon: '🥩', title: 'Priorizar proteína', text: 'Apuntá a 1.2-1.6g por kg de peso corporal. Ayuda a preservar músculo durante la pérdida de peso.' },
  { icon: '🍽️', title: 'Platos pequeños y frecuentes', text: 'La tirzepatida reduce el apetito significativamente. 3-5 comidas pequeñas son más fáciles de tolerar.' },
  { icon: '🥦', title: 'Vegetales en cada comida', text: 'Aportan fibra, vitaminas y volumen con pocas calorías. Ayudan con el tránsito intestinal.' },
  { icon: '💧', title: 'Hidratación constante', text: 'Tomá agua entre comidas, no durante. Mínimo 2.5L por día. Ayuda a reducir náuseas.' },
  { icon: '🚫', title: 'Evitar grasas pesadas y fritos', text: 'Pueden empeorar las náuseas. Preferí cocciones al vapor, horno o a la plancha.' },
  { icon: '🍬', title: 'Minimizar azúcares simples', text: 'Refrescos, dulces y harinas refinadas dificultan la pérdida de peso y pueden aumentar náuseas.' },
  { icon: '🧃', title: 'Evitar alcohol', text: 'El alcohol tiene muchas calorías vacías e interactúa negativamente con el tratamiento.' },
  { icon: '⏰', title: 'Respetar los horarios', text: 'Comer en horarios regulares ayuda a controlar el apetito residual.' },
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

  useEffect(() => { loadLists() }, [user])
  useEffect(() => { if (activeList) loadItems(activeList.id) }, [activeList])

  async function loadLists() {
    const { data } = await supabase.from('shopping_lists').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    setLists(data || [])
    if (data && data.length > 0 && !activeList) setActiveList(data[0])
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
      user_id: user.id, name: newListName.trim()
    }).select().single()
    if (!error) { setNewListName(''); setActiveList(data); loadLists() }
  }

  async function deleteList(id) {
    await supabase.from('shopping_lists').delete().eq('id', id)
    setActiveList(null)
    loadLists()
  }

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.name.trim() || !activeList) return
    const { error } = await supabase.from('shopping_items').insert({
      user_id: user.id, list_id: activeList.id,
      name: newItem.name.trim(), quantity: newItem.quantity, category: newItem.category
    })
    if (!error) { setNewItem(i => ({ ...i, name: '', quantity: '' })); loadItems(activeList.id) }
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
    const { error } = await supabase.from('shopping_items').insert({
      user_id: user.id, list_id: activeList.id,
      name: food.name, category: food.cat
    })
    if (!error) { showMsg('success', `✅ "${food.name}" agregado a la lista`); loadItems(activeList.id) }
  }

  const groupedItems = FOOD_CATEGORIES.reduce((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  const uncheckedCount = items.filter(i => !i.is_checked).length
  const checkedCount = items.filter(i => i.is_checked).length

  return (
    <div>
      <div className="page-header">
        <h1>🛒 Alimentación</h1>
        <p>Lista de supermercado, alimentos recomendados y consejos</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24 }}>
        {[['lista', '🛒 Lista de compras'], ['recomendados', '⭐ Alimentos recomendados'], ['consejos', '💡 Consejos']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '10px 20px', fontSize: 'var(--text-sm)', fontWeight: 500,
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === key ? 'var(--primary)' : 'var(--gray-500)', marginBottom: -1
            }}>
            {label}
          </button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {/* TAB: Lista de compras */}
      {tab === 'lista' && (
        <div className="section-grid">
          {/* Selector de lista */}
          <div className="card">
            <div className="card-title">📋 Mis listas</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input type="text" placeholder="Nombre de nueva lista" value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createList()}
                style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }} />
              <button className="btn-primary" onClick={createList}>Crear</button>
            </div>

            {lists.length === 0
              ? <p style={{ color: 'var(--gray-400)', fontSize: 'var(--text-sm)' }}>No tenés listas aún. Creá una arriba.</p>
              : lists.map(list => (
                <div key={list.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 4, cursor: 'pointer',
                  background: activeList?.id === list.id ? 'var(--primary-light)' : 'var(--gray-50)',
                  border: `1.5px solid ${activeList?.id === list.id ? 'var(--primary)' : 'var(--gray-200)'}`,
                }}
                  onClick={() => setActiveList(list)}>
                  <span style={{ fontWeight: activeList?.id === list.id ? 600 : 400, fontSize: 'var(--text-sm)', color: activeList?.id === list.id ? 'var(--primary-dark)' : 'var(--gray-700)' }}>
                    {list.name}
                  </span>
                  <button className="btn-icon" onClick={e => { e.stopPropagation(); deleteList(list.id) }}>🗑️</button>
                </div>
              ))}
          </div>

          {/* Items de la lista activa */}
          <div className="card">
            {!activeList
              ? <div className="empty-state"><div className="empty-state-icon">🛒</div><p>Seleccioná o creá una lista.</p></div>
              : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>🛒 {activeList.name}</div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                      {uncheckedCount} pendientes · {checkedCount} listos
                    </span>
                  </div>

                  {/* Agregar item */}
                  <form onSubmit={addItem} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Agregar ítem..." value={newItem.name}
                      onChange={e => setNewItem(i => ({ ...i, name: e.target.value }))} required
                      style={{ flex: 2, minWidth: 140, padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }} />
                    <input type="text" placeholder="Cantidad" value={newItem.quantity}
                      onChange={e => setNewItem(i => ({ ...i, quantity: e.target.value }))}
                      style={{ flex: 1, minWidth: 80, padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }} />
                    <select value={newItem.category} onChange={e => setNewItem(i => ({ ...i, category: e.target.value }))}
                      style={{ flex: 1, minWidth: 120, padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
                      {FOOD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button type="submit" className="btn-primary">+</button>
                  </form>

                  {items.length === 0
                    ? <div className="empty-state" style={{ padding: '32px 0' }}><p>La lista está vacía.</p></div>
                    : Object.entries(groupedItems).map(([cat, catItems]) => (
                      <div key={cat} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{cat}</div>
                        {catItems.map(item => (
                          <div key={item.id} className="shopping-item">
                            <input type="checkbox" checked={item.is_checked} onChange={() => toggleItem(item.id, item.is_checked)} />
                            <span className={`shopping-item-name ${item.is_checked ? 'checked' : ''}`}>{item.name}</span>
                            {item.quantity && <span className="shopping-item-qty">{item.quantity}</span>}
                            <button className="btn-icon" style={{ padding: 4 }} onClick={() => deleteItem(item.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    ))}

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

      {/* TAB: Alimentos recomendados */}
      {tab === 'recomendados' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {['Todas', ...FOOD_CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 600,
                  border: filterCat === cat ? '2px solid var(--primary)' : '2px solid var(--gray-300)',
                  background: filterCat === cat ? 'var(--primary-light)' : 'white',
                  color: filterCat === cat ? 'var(--primary-dark)' : 'var(--gray-600)',
                }}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {RECOMMENDED_FOODS
              .filter(f => filterCat === 'Todas' || f.cat === filterCat)
              .map(food => (
                <div key={food.name} style={{
                  padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)',
                  background: 'white', display: 'flex', flexDirection: 'column', gap: 8
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{food.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)' }}><span className="badge badge-gray">{food.cat}</span></div>
                    </div>
                    {food.protein !== '0' && (
                      <span className="badge badge-success">🥩 {food.protein}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', lineHeight: 1.5 }}>{food.note}</div>
                  <button onClick={() => addRecommended(food)}
                    style={{
                      fontSize: 'var(--text-xs)', fontWeight: 600, padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--primary)',
                      color: 'var(--primary)', background: 'white', transition: 'all 0.15s', marginTop: 4
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-light)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white' }}>
                    + Agregar a mi lista
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB: Consejos */}
      {tab === 'consejos' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
            {NUTRITION_TIPS.map(tip => (
              <div key={tip.title} style={{
                padding: 20, borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', background: 'white'
              }}>
                <div style={{ fontSize: '1.75rem', marginBottom: 8 }}>{tip.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>{tip.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', lineHeight: 1.7 }}>{tip.text}</div>
              </div>
            ))}
          </div>

          {/* Plan semanal sugerido */}
          <div className="card">
            <div className="card-title">📅 Plan de alimentación sugerido (por día tipo)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { meal: '🌅 Desayuno', items: ['Yogur griego natural', 'Avena cocida', '1 fruta pequeña', 'Café o té sin azúcar'], protein: '~25g' },
                { meal: '☀️ Almuerzo', items: ['Proteína magra (pollo/pescado/carne)', 'Vegetales al vapor o salteados', 'Porción pequeña de arroz integral o legumbres'], protein: '~40g' },
                { meal: '🍎 Merienda', items: ['Queso cottage', 'Puñado de almendras', 'Clara de huevo cocida'], protein: '~20g' },
                { meal: '🌙 Cena', items: ['Proteína magra o huevos', 'Ensalada verde abundante', 'Aceite de oliva y limón'], protein: '~35g' },
              ].map(plan => (
                <div key={plan.meal} style={{ padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--primary)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>{plan.meal}</div>
                  <ul style={{ paddingLeft: 16, fontSize: 'var(--text-xs)', color: 'var(--gray-600)', lineHeight: 2 }}>
                    {plan.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--secondary)' }}>
                    Proteína: {plan.protein}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 14, background: 'var(--secondary-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: '#065f46' }}>
              <strong>💪 Meta proteica total:</strong> ~120g/día (ajustá según tu peso y objetivo con tu médico)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
