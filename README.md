# 📺 VideoNKT

**Plataforma de video interactivo para secundaria del Colegio Nikola Tesla**  
Integración completa con la Nueva Escuela Mexicana (NEM)

---

## ✨ Características

### Para docentes
- 🔐 Acceso con Google Workspace for Education
- 👥 Creación de grupos con código de invitación único
- 📚 Soporte para múltiples materias:
  - **Matemáticas** (Álgebra, Geometría, Aritmética, Trigonometría)
  - **Historia** (Historia de México, Historia Universal)
  - **Biología** (Ecología, Genética, Evolución, Anatomía)
- 🎓 Integración NEM completa:
  - 4 Campos Formativos
  - 146 Contenidos curriculares
  - 440 Procesos de Desarrollo de Aprendizaje (PDAs)
- 🎬 Asignación de videos (YouTube) con:
  - Preguntas interactivas (opción múltiple, V/F, abiertas)
  - Pausas automáticas en timestamps configurables
  - Calificación automática 0-100
- 📊 Reportes completos:
  - Vista general con estadísticas y gráficas
  - Reporte por preguntas (matriz estilo Code.org)
  - Exportar a CSV
  - Calificación manual de preguntas abiertas

### Para estudiantes
- 🔐 Acceso con Google (@nikolatesla.edu.mx)
- 📝 Unirse a grupos con código
- ▶️ Ver videos con preguntas integradas
- ⏸ El video se pausa automáticamente hasta responder
- 🏆 Calificación automática al completar
- 📌 Retomar actividades desde donde las dejó

---

## 🛠 Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS (tema custom: sepia, parchment, gold, crimson) |
| Autenticación | Supabase Auth (Google OAuth) |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Video | YouTube iframe (youtube-nocookie.com) |
| Gráficas | Recharts |
| Deploy | Vercel |

---

## 📁 Estructura del proyecto

videonkt/
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase + tipos + catálogo NEM
│   │   └── auth.tsx             # Context de autenticación
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── AuthCallback.tsx     # OAuth redirect + asignación de rol
│   │   ├── teacher/
│   │   │   ├── TeacherDashboard.tsx
│   │   │   ├── TeacherGroups.tsx
│   │   │   ├── TeacherAssignments.tsx
│   │   │   ├── CreateAssignment.tsx  # Editor con integración NEM
│   │   │   └── TeacherReports.tsx    # 2 vistas: general + matriz
│   │   └── student/
│   │       ├── StudentDashboard.tsx
│   │       └── WatchVideo.tsx        # Reproductor interactivo
│   ├── components/shared/
│   │   └── Layout.tsx
│   ├── App.tsx
│   └── main.tsx
└── README.md
---

## 🗃 Esquema de base de datos

profiles          → Usuarios (docentes y estudiantes)
teachers          → Emails de docentes autorizados
groups            → Grupos con códigos de invitación
group_members     → Relación estudiante ↔ grupo
video_assignments → Actividades con metadatos NEM
questions         → Preguntas con timestamps
student_sessions  → Sesiones por estudiante
student_answers   → Respuestas individuales
campos_formativos → Catálogo NEM
contenidos_nem    → 146 contenidos curriculares
pdas              → 440 Procesos de Desarrollo de Aprendizaje

**Row Level Security (RLS)** activo en todas las tablas.  
**Triggers** de PostgreSQL para calificación automática.

---

## 🚀 Instalación local
```bash
git clone https://github.com/lhinojosa57/videonkt.git
cd videonkt
npm install

# Configurar .env
cp .env.example .env
# Editar .env con tus credenciales de Supabase

npm run dev
```

---

## 🎓 Integración NEM

### Campos Formativos
- Lenguajes
- Saberes y Pensamiento Científico
- Ética, Naturaleza y Sociedades
- De lo Humano y lo Comunitario

### Materias soportadas
- **Matemáticas:** 48 contenidos (Álgebra, Geometría, Aritmética, Trigonometría)
- **Historia:** 50 contenidos (México, Universal)
- **Biología:** 48 contenidos (Ecología, Genética, Evolución, Anatomía)

### PDAs (Procesos de Desarrollo de Aprendizaje)
- 3 PDAs por contenido
- 440 PDAs en total
- Formato: `[MATERIA.AREA.CONTENIDO]`

---

## 📄 Licencia

MIT — libre para uso educativo.

---

## 👥 Créditos

Desarrollado para el **Colegio Nikola Tesla** (nikolatesla.edu.mx)  
Nueva Escuela Mexicana · Secundaria · 2025-2026