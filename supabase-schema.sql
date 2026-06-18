-- ============================================================
-- HEALTH TRACKER - Esquema de Base de Datos para Supabase
-- Ejecutar este SQL en el SQL Editor de Supabase
-- ============================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: profiles (perfil extendido de cada usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date DATE,
  height_cm NUMERIC(5,1),
  goal_weight NUMERIC(5,1),
  current_dose NUMERIC(4,2) DEFAULT 2.5, -- dosis tirzepatida en mg
  injection_day TEXT DEFAULT 'lunes',     -- día habitual de inyección
  goal_protein_g INTEGER DEFAULT 120,     -- meta diaria de proteína en gramos
  goal_water_ml INTEGER DEFAULT 2500,     -- meta diaria de agua en ml
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: cada usuario solo ve su propio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TABLA: weight_records (peso corporal)
-- ============================================================
CREATE TABLE IF NOT EXISTS weight_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,1) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weight_own" ON weight_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_weight_user_date ON weight_records(user_id, date DESC);

-- ============================================================
-- TABLA: body_measurements (medidas corporales)
-- ============================================================
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  waist_cm NUMERIC(5,1),       -- cintura
  hip_cm NUMERIC(5,1),         -- cadera
  chest_cm NUMERIC(5,1),       -- pecho
  arm_right_cm NUMERIC(5,1),   -- brazo derecho
  arm_left_cm NUMERIC(5,1),    -- brazo izquierdo
  thigh_right_cm NUMERIC(5,1), -- muslo derecho
  thigh_left_cm NUMERIC(5,1),  -- muslo izquierdo
  calf_cm NUMERIC(5,1),        -- pantorrilla
  neck_cm NUMERIC(5,1),        -- cuello
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "measurements_own" ON body_measurements FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_measurements_user_date ON body_measurements(user_id, date DESC);

-- ============================================================
-- TABLA: bioimpedance_records (biopedancia mensual)
-- ============================================================
CREATE TABLE IF NOT EXISTS bioimpedance_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  body_fat_pct NUMERIC(4,1),       -- % grasa corporal
  muscle_mass_kg NUMERIC(5,1),     -- masa muscular kg
  bone_mass_kg NUMERIC(4,2),       -- masa ósea kg
  water_pct NUMERIC(4,1),          -- % agua corporal
  visceral_fat INTEGER,            -- grasa visceral (nivel 1-20)
  metabolic_age INTEGER,           -- edad metabólica
  bmi NUMERIC(4,1),                -- IMC
  basal_metabolic_rate INTEGER,    -- metabolismo basal (kcal)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bioimpedance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bioimpedance_own" ON bioimpedance_records FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_bioimpedance_user_date ON bioimpedance_records(user_id, date DESC);

-- ============================================================
-- TABLA: tirzepatide_logs (registro de inyecciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS tirzepatide_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  dose_mg NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  injection_site TEXT, -- abdomen_izq, abdomen_der, muslo_izq, muslo_der, brazo_izq, brazo_der
  time_of_day TEXT,    -- mañana, tarde, noche
  side_effects TEXT[], -- náuseas, vómitos, fatiga, etc.
  notes TEXT,
  next_dose_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tirzepatide_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tirzepatide_own" ON tirzepatide_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_tirzepatide_user_date ON tirzepatide_logs(user_id, date DESC);

-- ============================================================
-- TABLA: nutrition_logs (registro nutricional por comida)
-- ============================================================
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL, -- desayuno, almuerzo, merienda, cena, snack
  meal_name TEXT,          -- descripción de la comida
  protein_g NUMERIC(5,1) DEFAULT 0,
  calories INTEGER,
  carbs_g NUMERIC(5,1),
  fat_g NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nutrition_own" ON nutrition_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_nutrition_user_date ON nutrition_logs(user_id, date DESC);

-- ============================================================
-- TABLA: water_logs (registro de hidratación)
-- ============================================================
CREATE TABLE IF NOT EXISTS water_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_ml INTEGER NOT NULL DEFAULT 250,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "water_own" ON water_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_water_user_date ON water_logs(user_id, date DESC);

-- ============================================================
-- TABLA: exercise_logs (registro de ejercicio)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  exercise_type TEXT NOT NULL, -- caminata, cardio, pesas, yoga, natación, etc.
  duration_min INTEGER NOT NULL,
  intensity TEXT DEFAULT 'media', -- baja, media, alta
  calories_burned INTEGER,
  distance_km NUMERIC(5,2),
  sets INTEGER,
  reps INTEGER,
  weight_used_kg NUMERIC(5,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise_own" ON exercise_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_exercise_user_date ON exercise_logs(user_id, date DESC);

-- ============================================================
-- TABLA: shopping_lists (listas de supermercado)
-- ============================================================
CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Mi lista',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopping_lists_own" ON shopping_lists FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TABLA: shopping_items (ítems de cada lista)
-- ============================================================
CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,        -- "500g", "2 unidades", etc.
  category TEXT,        -- proteínas, verduras, lácteos, etc.
  is_checked BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shopping_items_own" ON shopping_items FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_shopping_items_list ON shopping_items(list_id);
