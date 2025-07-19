# BOOM Barbershop - Website & Booking System

Un website modern și elegant pentru frizeria BOOM, cu sistem de programări online și panou de administrare.

## 🎯 Despre Proiect

BOOM Barbershop este o frizerie tradițională inspirată, oferind experiențe personalizate de cea mai înaltă calitate. Website-ul oferă o interfață elegantă pentru clienți și un sistem complet de administrare pentru gestionarea programărilor.

## ✨ Caracteristici

### Pentru Clienți
- **Design elegant** cu fundal transparent și stil modern
- **Sistem de programări online** cu calendar interactiv
- **Alegerea specialistului** și serviciului dorit
- **Vizualizarea programului** în timp real
- **Confirmarea programării** prin formular online

### Pentru Administrare
- **Panou de administrare** complet
- **Gestionarea programărilor** (acceptare/respingere)
- **Administrarea specialiștilor** (adăugare, editare, ștergere)
- **Gestionarea serviciilor** și prețurilor
- **Calendar interactiv** pentru vizualizarea programărilor

## 🛠 Tehnologii Folosite

### Frontend
- **React.js** - Framework principal
- **CSS3** - Stilizare cu variabile CSS și flexbox/grid
- **HTML5** - Structura semantică

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL Database
  - Real-time subscriptions
  - Authentication
  - Row Level Security

### Alte Tehnologii
- **Date-fns** - Manipularea datelor
- **React Router** - Navigarea în aplicație

## 📁 Structura Proiectului

```
BoomBarbershop/
├── frontend/
│   ├── src/
│   │   ├── App.js          # Componenta principală
│   │   ├── App.css         # Stilizare completă
│   │   ├── supabaseClient.js # Configurare Supabase
│   │   └── ...             # Alte fișiere React
│   ├── public/
│   │   ├── index.html
│   │   └── ...             # Assets statice
│   └── package.json
└── README.md
```

## 🚀 Instalare și Configurare

### Cerințe
- Node.js (versiunea 16 sau mai nouă)
- npm sau yarn
- Cont Supabase

### Pași de Instalare

1. **Clonează repository-ul**
   ```bash
   git clone https://github.com/Boombarbershop04/app.git
   cd BoomBarbershop
   ```

2. **Instalează dependențele**
   ```bash
   cd frontend
   npm install
   ```

3. **Configurează Supabase**
   - Creează un proiect pe [supabase.com](https://supabase.com)
   - Copiază URL-ul și cheia API din Settings > API
   - Actualizează `supabaseClient.js` cu credențialele tale

4. **Creează tabelele în Supabase**
   ```sql
   -- Tabela pentru specialiști
   CREATE TABLE barbers (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     avatar_url TEXT
   );

   -- Tabela pentru servicii
   CREATE TABLE services (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     price DECIMAL(10,2) NOT NULL,
     discount_percent INTEGER DEFAULT 0
   );

   -- Tabela pentru programări
   CREATE TABLE appointments (
     id SERIAL PRIMARY KEY,
     user_name TEXT NOT NULL,
     user_phone TEXT NOT NULL,
     user_email TEXT NOT NULL,
     barber_id INTEGER REFERENCES barbers(id),
     service_id INTEGER REFERENCES services(id),
     date DATE NOT NULL,
     hour TEXT NOT NULL,
     status TEXT DEFAULT 'pending',
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

5. **Pornește aplicația**
   ```bash
   npm start
   ```

## 🔧 Configurare Admin

Pentru a accesa panoul de administrare:
1. Navighează la `/admin`
2. Folosește credențialele configurate în Supabase
3. Gestionează programările, specialiștii și serviciile

## 📱 Responsive Design

Website-ul este complet responsive și optimizat pentru:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## 🎨 Design Features

- **Fundal transparent** cu imagine grayscale
- **Culori portocalii cărămizii** pentru accent
- **Animații smooth** la scroll și hover
- **Typography elegantă** cu fonturi moderne
- **Layout flexibil** cu CSS Grid și Flexbox

## 🔒 Securitate

- Autentificare Supabase pentru admin
- Row Level Security în database
- Validare input pe frontend și backend
- Protecție împotriva SQL injection

## 📞 Contact

Pentru suport tehnic sau întrebări despre proiect, contactează echipa de dezvoltare.

---

**BOOM Barbershop** - Experiența perfectă de frizerie tradițională
