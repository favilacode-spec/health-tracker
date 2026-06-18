# 🚀 Instrucciones de Despliegue — Health Tracker

Seguí estos pasos en orden. No necesitás saber programar para hacerlo.

---

## PASO 1 — Crear cuenta en Supabase (base de datos + login)

1. Entrá a [supabase.com](https://supabase.com) y hacé clic en **"Start your project"**
2. Registrate con tu cuenta de GitHub o email
3. Hacé clic en **"New project"**
4. Completá:
   - **Name**: `health-tracker` (o el nombre que quieras)
   - **Database Password**: inventá una contraseña fuerte y **guardala**
   - **Region**: elegí la más cercana (South America si está disponible, o US East)
5. Esperá ~2 minutos mientras se crea el proyecto

---

## PASO 2 — Crear las tablas en Supabase

1. En tu proyecto de Supabase, hacé clic en **"SQL Editor"** (en el menú izquierdo)
2. Hacé clic en **"New query"**
3. Abrí el archivo `supabase-schema.sql` de esta carpeta
4. Copiá **todo** su contenido y pegalo en el editor de Supabase
5. Hacé clic en **"Run"** (o presioná Ctrl+Enter)
6. Deberías ver: `Success. No rows returned`

---

## PASO 3 — Obtener las claves de Supabase

> 💡 **¿Qué son las "API keys"?** Son contraseñas automáticas que permiten que tu app se conecte a la base de datos de Supabase. No las tenés que inventar, Supabase las genera solas.

1. En Supabase, andá a **Settings → API** (en el menú izquierdo, ícono de engranaje ⚙️)
2. Vas a ver dos valores que necesitás:
   - **Project URL**: algo como `https://abcdefgh.supabase.co` → es la dirección de tu base de datos
   - **anon/public key**: un texto muy largo que empieza con `eyJ...` → es la clave de acceso pública
3. Copiá ambos valores (hay un botón de copiar al lado de cada uno), los vas a necesitar en el paso 5

---

## PASO 4 — Subir el código a GitHub

1. Entrá a [github.com](https://github.com) y creá una cuenta si no tenés
2. Hacé clic en **"New repository"** (ícono +)
3. Nombre del repo: `health-tracker`
4. Dejalo en **Public** y hacé clic en **"Create repository"**
5. La carpeta `health-tracker` ya fue creada por Claude en tu carpeta de proyectos: **`/Users/editor/Claude/Projects/Avance David Alvarado/health-tracker`** — podés verla en Finder en esa ubicación.
   - Abrí la Terminal (Mac: Cmd+Space → "Terminal")
   - Navegá a esa carpeta con este comando: `cd "/Users/editor/Claude/Projects/Avance David Alvarado/health-tracker"`
   - Ejecutá estos comandos uno por uno:
     ```
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/TU_USUARIO/health-tracker.git
     git push -u origin main
     ```
   - Reemplazá `TU_USUARIO` con tu usuario de GitHub
   - Cuando pida **usuario**: escribí tu usuario de GitHub (el que aparece en tu perfil)
   - Cuando pida **contraseña**: **no uses tu contraseña de Google**. GitHub ya no acepta contraseñas normales. Necesitás un **Token de acceso personal**. Seguí estos pasos para crearlo:
     1. En GitHub, hacé clic en tu foto de perfil → **Settings**
     2. En el menú izquierdo, bajá hasta **Developer settings** (al fondo)
     3. Hacé clic en **Personal access tokens → Tokens (classic)**
     4. Hacé clic en **"Generate new token (classic)"**
     5. En **Note** escribí: `health-tracker`
     6. En **Expiration** elegí `90 days` o `No expiration`
     7. En los permisos, tildá **`repo`** (el primero, que selecciona todos los subopciones de repo)
     8. Bajá y hacé clic en **"Generate token"**
     9. **Copiá el token que aparece** (empieza con `ghp_...`) — solo se muestra una vez
     10. Volvé a la Terminal y pegá ese token cuando te pida la contraseña

---

## PASO 5 — Desplegar en Vercel

1. Entrá a [vercel.com](https://vercel.com) y registrate con tu cuenta de GitHub
2. Hacé clic en **"Add New → Project"**
3. Importá el repositorio `health-tracker` que creaste
4. Antes de hacer Deploy, buscá la sección **"Environment Variables"** y agregá:
   - **Name**: `VITE_SUPABASE_URL` → **Value**: la URL de Supabase del paso 3
   - **Name**: `VITE_SUPABASE_ANON_KEY` → **Value**: la **publishable key** del paso 3 (la que empieza con `sb_publishable_...`)
5. Hacé clic en **"Deploy"**
6. Esperá ~2 minutos. Al finalizar, Vercel te da una URL como `health-tracker-xyz.vercel.app`

¡Listo! Esa URL es tu app funcionando en internet. Podés compartirla con quien quieras.

---

## PASO 6 — Configurar el email de confirmación en Supabase (opcional pero recomendado)

Por defecto, Supabase pide confirmar el email al registrarse. Para desactivarlo mientras están probando:

1. En Supabase → **Authentication → Settings**
2. En **"Email Auth"**, desactivá **"Enable email confirmations"**
3. Guardá

Esto permite registrarse sin confirmar el email. Cuando quieran activarlo de nuevo, simplemente volvelo a activar.

---

## Instalar las dependencias (solo para correr en tu computadora)

Si querés probarlo localmente antes de subir:

```bash
cd "/Users/editor/Claude/Projects/Avance David Alvarado/health-tracker"
npm install
cp .env.example .env
# Editá .env con tus claves de Supabase
npm run dev
```

Abrí `http://localhost:5173` en el navegador.

---

## Estructura del proyecto

```
health-tracker/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx      → Resumen general
│   │   ├── Peso.jsx           → Peso y medidas corporales
│   │   ├── Biopedancia.jsx    → Biopedancia mensual
│   │   ├── Tirzepatida.jsx    → Registro de inyecciones
│   │   ├── Nutricion.jsx      → Proteína, agua, comidas
│   │   ├── Ejercicio.jsx      → Actividad física
│   │   ├── Alimentacion.jsx   → Lista de compras + consejos
│   │   ├── Perfil.jsx         → Configuración del usuario
│   │   └── Login.jsx          → Autenticación
│   ├── components/
│   │   └── Layout.jsx         → Sidebar y navegación
│   ├── context/
│   │   └── AuthContext.jsx    → Manejo de sesión
│   └── lib/
│       └── supabase.js        → Conexión a base de datos
├── supabase-schema.sql        → SQL para crear las tablas
└── .env.example               → Template de variables de entorno
```

---

## ¿Necesitás ayuda?

Cualquier duda sobre los pasos, consultale directamente a Claude. Con los mensajes de error o la pantalla donde te trabaste es suficiente para resolver cualquier problema.
