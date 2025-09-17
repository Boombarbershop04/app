import React, { useState, useEffect, useMemo, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import { addDays, format, isSameDay, isToday, startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";
import { ro } from "date-fns/locale";
import { supabase } from "./supabaseClient";
import logo from "./logo.png";
import logo2 from "./logo2.png";

const SPECIALISTS = [
  { name: "Bobo", status: "liber", desc: "Patronul. Cea mai mare experiență, tunsori clasice și moderne." },
  { name: "Alex", status: "liber", desc: "Specialist în tunsori moderne, rapid și atent la detalii." },
  { name: "Mihai", status: "liber", desc: "Expert în fade-uri și bărbierit tradițional." }
];

const SLOT_GROUPS = [
  { label: "Dimineață", range: [9, 12] },
  { label: "Amiază", range: [12, 16] },
  { label: "Seară", range: [16, 21] }
];

// Definim ALL_SLOTS unic pentru ambele calendare
const ALL_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h < 21; ++h) {
    for (let m = 0; m < 60; m += 40) {
      slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return slots;
})();

function getDaysOfMonth(monthDate) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = [];
  for (let d = start; !isAfter(d, end); d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

function AdminLogin() {
  const [form, setForm] = useState({ user: "", pass: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = e => {
    e.preventDefault();
    // simple auth: user "bobo", pass "$Boom"
    if (form.user === "bobo" && form.pass === "$Boom") {
      localStorage.setItem("isAdmin", "true");
      // persist for current session
      sessionStorage.setItem("isAdmin", "true");
      navigate("/admin/dashboard");
    } else {
      setError("Date de autentificare incorecte!");
    }
  };
  return (
    <div className="admin-login-page">
      <form className="admin-login-form" onSubmit={handleSubmit}>
        <h2>Autentificare admin</h2>
        <input type="text" name="user" placeholder="Utilizator" value={form.user} onChange={handleChange} autoFocus />
        <input type="password" name="pass" placeholder="Parolă" value={form.pass} onChange={handleChange} />
        {error && <div className="admin-login-error">{error}</div>}
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const [specialists, setSpecialists] = useState([]);
  const [hours] = useState(ALL_SLOTS);
  // Navigare pe zile cu săgeți
  const [adminDay, setAdminDay] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(adminDay, 'yyyy-MM-dd'));
  useEffect(() => {
    setSelectedDay(format(adminDay, 'yyyy-MM-dd'));
  }, [adminDay]);
  const [bookings, setBookings] = useState([]);
  const [pending, setPending] = useState([]);

  // Fetch barbers din Supabase
  useEffect(() => {
    async function fetchBarbers() {
      const { data } = await supabase.from('barbers').select('*').order('name');
      if (data) setSpecialists(data);
    }
    fetchBarbers();
  }, []);

  // Realtime update appointments
  useEffect(() => {
    const channel = supabase.channel('realtime:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, payload => {
        // Refetch bookings și pending la orice modificare
        fetchBookings();
        fetchPending();
      })
      .subscribe();
    async function fetchBookings() {
      const { data } = await supabase
        .from('appointments')
        .select('*, barbers(name)')
        .eq('date', selectedDay);
      if (data) setBookings(data);
    }
    async function fetchPending() {
      const { data } = await supabase
        .from('appointments')
        .select('*, barbers(name)')
        .eq('status', 'pending');
      if (data) setPending(data);
    }
    fetchBookings();
    fetchPending();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDay]);

  async function handleAccept(appointmentId) {
    await supabase.from('appointments').update({ status: 'accepted' }).eq('id', appointmentId);
    setBookings(prev => prev.map(b => b.id === appointmentId ? { ...b, status: 'accepted' } : b));
    setPending(prev => prev.filter(b => b.id !== appointmentId));
  }
  async function handleReject(appointmentId) {
    await supabase.from('appointments').update({ status: 'rejected' }).eq('id', appointmentId);
    setBookings(prev => prev.map(b => b.id === appointmentId ? { ...b, status: 'rejected' } : b));
    setPending(prev => prev.filter(b => b.id !== appointmentId));
  }

  function getSlotStatus(barber, hour) {
    const b = bookings.find(b => b.barber_id === barber.id && b.hour === hour);
    if (!b) return { status: "free" };
    return b;
  }

  // Adaug handler pentru click pe slot
  async function handleSlotToggle(barberId, date, hour) {
    // Caută dacă există deja o programare pe slotul respectiv
    const existing = bookings.find(b => b.barber_id === barberId && b.date === date && b.hour === hour && (b.status === 'accepted' || b.status === 'confirmed'));
    if (existing) {
      // Dacă e ocupat, șterge programarea
      await supabase.from('appointments').delete().eq('id', existing.id);
      setBookings(prev => prev.filter(b => b.id !== existing.id));
    } else {
      // Dacă e liber, creează o programare dummy cu status 'accepted'
      const { data } = await supabase.from('appointments').insert({
        user_name: 'Slot ocupat',
        user_phone: '',
        user_email: '',
        barber_id: barberId,
        date,
        hour,
        status: 'accepted'
      }).select();
      if (data && data[0]) setBookings(prev => [...prev, data[0]]);
    }
  }

  // Controller pentru gestionare barbers
  const [newBarber, setNewBarber] = useState({ name: '', description: '', avatar_url: '' });
  async function handleBarberChange(id, field, value) {
    await supabase.from('barbers').update({ [field]: value }).eq('id', id);
    setSpecialists(specialists => specialists.map(b => b.id === id ? { ...b, [field]: value } : b));
  }
  async function handleBarberDelete(id) {
    await supabase.from('barbers').delete().eq('id', id);
    setSpecialists(specialists => specialists.filter(b => b.id !== id));
  }
  async function handleBarberAdd(e) {
    e.preventDefault();
    if (!newBarber.name) return;
    const { data } = await supabase.from('barbers').insert([newBarber]).select();
    if (data && data[0]) setSpecialists(specialists => [...specialists, data[0]]);
    setNewBarber({ name: '', description: '', avatar_url: '' });
  }

  // Controller pentru gestionare servicii
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState({ name: '', description: '', price: '', discount_percent: '' });
  useEffect(() => {
    async function fetchServices() {
      const { data } = await supabase.from('services').select('*').order('name');
      if (data) setServices(data);
    }
    fetchServices();
  }, []);
  async function handleServiceChange(id, field, value) {
    await supabase.from('services').update({ [field]: value }).eq('id', id);
    setServices(services => services.map(s => s.id === id ? { ...s, [field]: value } : s));
  }
  async function handleServiceDelete(id) {
    await supabase.from('services').delete().eq('id', id);
    setServices(services => services.filter(s => s.id !== id));
  }
  async function handleServiceAdd(e) {
    e.preventDefault();
    if (!newService.name || !newService.price) return;
    const { data } = await supabase.from('services').insert([newService]).select();
    if (data && data[0]) setServices(services => [...services, data[0]]);
    setNewService({ name: '', description: '', price: '', discount_percent: '' });
  }

  // logout button
  const navigate = useNavigate();
  function handleLogout() {
    localStorage.removeItem("isAdmin");
    navigate("/admin");
  }

  // State pentru modal slot
  const [slotModal, setSlotModal] = useState({ open: false, barber: null, hour: null, slot: null });

  // Handler click pe slot
  function handleSlotClick(barber, hour) {
    const slot = getSlotStatus(barber, hour);
    setSlotModal({ open: true, barber, hour, slot });
  }
  function closeSlotModal() {
    setSlotModal({ open: false, barber: null, hour: null, slot: null });
  }
  // Handler pentru opțiuni slot
  async function setSlotStatus(status) {
    const { barber, hour, slot } = slotModal;
    if (!barber || !hour) return;
    if (slot && slot.id) {
      if (status === 'liber') {
        // Marchează ca anulat de admin, nu șterge, păstrează datele clientului
        await supabase.from('appointments').update({ status: 'anulat_admin' }).eq('id', slot.id);
        // Refetch bookings din DB pentru UI corect
        const { data } = await supabase
          .from('appointments')
          .select('*, barbers(name)')
          .eq('date', selectedDay);
        if (data) setBookings(data);
      } else {
        // Update status (pauza/accepted)
        await supabase.from('appointments').update({ status }).eq('id', slot.id);
        setBookings(prev => prev.map(b => b.id === slot.id ? { ...b, status } : b));
      }
    } else {
      // Creează dummy dacă nu există
      if (status === 'accepted' || status === 'pauza') {
        const { data } = await supabase.from('appointments').insert({
          user_name: 'Slot ocupat',
          user_phone: '',
          user_email: '',
          barber_id: barber.id,
          date: selectedDay,
          hour,
          status
        }).select();
        if (data && data[0]) setBookings(prev => [...prev, data[0]]);
      }
    }
    closeSlotModal();
  }

  // Pentru lookup rapid la servicii după id
  const serviceMap = useMemo(() => {
    const map = {};
    services.forEach(s => { map[s.id] = s; });
    return map;
  }, [services]);

  return (
    <div className="admin-dashboard">
      <button style={{position: 'absolute', top: 18, right: 24, background: '#111', color: '#fff', border: 'none', borderRadius: 7, padding: '0.5rem 1.2rem', fontWeight: 700, cursor: 'pointer'}} onClick={handleLogout}>Logout</button>
      <h2 className="admin-dash-title">Calendar programări</h2>
      {/* Pending section ascunsă la cerere */}
      <div className="admin-barbers-controller">
        <h3>Gestionează frizerii</h3>
        <form className="admin-barber-add" onSubmit={handleBarberAdd}>
          <input type="text" placeholder="Nume" value={newBarber.name} onChange={e => setNewBarber(b => ({ ...b, name: e.target.value }))} required />
          <input type="text" placeholder="Descriere" value={newBarber.description} onChange={e => setNewBarber(b => ({ ...b, description: e.target.value }))} />
          <input type="text" placeholder="Avatar URL" value={newBarber.avatar_url} onChange={e => setNewBarber(b => ({ ...b, avatar_url: e.target.value }))} />
          <button type="submit">Adaugă frizer</button>
        </form>
        <div className="admin-barbers-list">
          {specialists.map(b => (
            <div key={b.id} className="admin-barber-row">
              <input type="text" value={b.name} onChange={e => handleBarberChange(b.id, 'name', e.target.value)} />
              <input type="text" value={b.description || ''} onChange={e => handleBarberChange(b.id, 'description', e.target.value)} />
              <input type="text" value={b.avatar_url || ''} onChange={e => handleBarberChange(b.id, 'avatar_url', e.target.value)} />
              <button className="admin-barber-delete" onClick={() => handleBarberDelete(b.id)}>Șterge</button>
            </div>
          ))}
        </div>
      </div>
      <div className="admin-services-controller" style={{marginTop: 32}}>
        <h3>Gestionează serviciile</h3>
        <form className="admin-service-add" onSubmit={handleServiceAdd} style={{display: 'flex', gap: 8, marginBottom: 12}}>
          <input type="text" placeholder="Nume serviciu" value={newService.name} onChange={e => setNewService(s => ({ ...s, name: e.target.value }))} required />
          <input type="text" placeholder="Descriere" value={newService.description} onChange={e => setNewService(s => ({ ...s, description: e.target.value }))} />
          <input type="number" placeholder="Preț (lei)" value={newService.price} onChange={e => setNewService(s => ({ ...s, price: e.target.value }))} required min="0" style={{width: 90}} />
          <input type="number" placeholder="Reducere (%)" value={newService.discount_percent} onChange={e => setNewService(s => ({ ...s, discount_percent: e.target.value }))} min="0" max="100" style={{width: 90}} />
          <button type="submit">Adaugă serviciu</button>
        </form>
        <div className="admin-services-list">
          {services.map(s => (
            <div key={s.id} className="admin-service-row" style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6}}>
              <input type="text" value={s.name} onChange={e => handleServiceChange(s.id, 'name', e.target.value)} style={{width: 140}} />
              <input type="text" value={s.description || ''} onChange={e => handleServiceChange(s.id, 'description', e.target.value)} style={{width: 220}} />
              <input type="number" value={s.price} onChange={e => handleServiceChange(s.id, 'price', e.target.value)} style={{width: 90}} />
              <input type="number" value={s.discount_percent || ''} onChange={e => handleServiceChange(s.id, 'discount_percent', e.target.value)} min="0" max="100" style={{width: 90}} />
              <button className="admin-service-delete" onClick={() => handleServiceDelete(s.id)} style={{background: '#c82333', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer'}}>Șterge</button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer legal mutat pe public site */}
      <div className="admin-dash-date-header">
        <button className="calendar-arrow" onClick={() => setAdminDay(addDays(adminDay, -1))}>&#8592;</button>
        <span className="admin-dash-date-label">{format(adminDay, "EEEE, d MMMM yyyy", {locale: ro})}</span>
        <button className="calendar-arrow" onClick={() => setAdminDay(addDays(adminDay, 1))}>&#8594;</button>
      </div>
      <div className="admin-dash-calendar">
        <div className="admin-dash-header-row">
          <div className="admin-dash-hour-col"></div>
          {specialists.map(s => <div key={s.id} className="admin-dash-spec-col">{s.name}</div>)}
        </div>
        {hours.map(hour => (
          <div className="admin-dash-row" key={hour}>
            <div className="admin-dash-hour-col">{hour}</div>
            {specialists.map(s => {
              const slot = getSlotStatus(s, hour);
              const isInactive = slot.status === "accepted" || slot.status === "confirmed" || slot.status === "rejected" || slot.status === "pauza";
              return (
                <div
                  key={s.id}
                  className={`admin-dash-slot admin-dash-slot-${slot.status}${isInactive ? " admin-dash-slot-inactive" : ""}`}
                  onClick={() => handleSlotClick(s, hour)}
                  style={{ cursor: 'pointer' }}
                >
                  {slot.status === "free" && <span className="slot-free">Liber</span>}
                  {slot.status === "pending" && (
                    <>
                      <span className="slot-pending">Solicitare: {slot.user_name}</span>
                      <button className="admin-dash-accept" onClick={e => { e.stopPropagation(); handleAccept(slot.id); }}>Marchează acceptat</button>
                    </>
                  )}
                  {slot.status === "accepted" && (
                    <span className="slot-confirmed">
                      {slot.user_name === "Slot ocupat" ? "Ocupat de admin" : `Rezervat: ${slot.user_name}`}
                    </span>
                  )}
                  {slot.status === "pauza" && <span className="slot-confirmed">Pauză</span>}
                  {slot.status === "confirmed" && <span className="slot-confirmed">Rezervat: {slot.user_name}</span>}
                  {slot.status === "rejected" && <span className="slot-rejected">Respins</span>}
                  {slot.status === "anulat_admin" && (
                    <span className="slot-rezervare-anulata">Rezervare anulată</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* Modal slot admin */}
      {slotModal.open && (
        <div className="slot-modal-overlay" onClick={closeSlotModal}>
          <div className="slot-modal" onClick={e => e.stopPropagation()}>
            <div className="slot-modal-title">Opțiuni slot {slotModal.hour} - {slotModal.barber?.name}</div>
            {slotModal.slot ? (
              <div className="slot-modal-details">
                <b>Client:</b> {slotModal.slot.user_name}<br/>
                <b>Telefon:</b> {slotModal.slot.user_phone}<br/>
                <b>Email:</b> {slotModal.slot.user_email || '-'}<br/>
                <b>Status:</b> {slotModal.slot.status}<br/>
                <b>Pachet:</b> {slotModal.slot.service_name || serviceMap[slotModal.slot.service_id]?.name || '-'}
              </div>
            ) : null}
            <div className="slot-modal-actions">
              <button onClick={() => setSlotStatus('pauza')}>Pauză</button>
              <button onClick={() => setSlotStatus('accepted')}>Ocupat</button>
              <button onClick={() => setSlotStatus('liber')}>Liber</button>
              <button onClick={closeSlotModal}>Anulează</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedSpecialist, setSelectedSpecialist] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [reservationStatus, setReservationStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  // simple scroll reveal for elements with class 'reveal'
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
  const [submitAttempts, setSubmitAttempts] = useState(0);

  // Scroll effect pentru header
  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector('.boom-header');
      if (header) {
        if (window.scrollY > 50) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleOpenCalendar = () => {
    setCalendarOpen(true);
    setStep(1);
    setSelectedSpecialist(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setFormData({ name: "", phone: "", email: "" });
    setCalendarMonth(new Date());
    setSelectedService(null);
  };
  const handleCloseCalendar = () => setCalendarOpen(false);

  // Fetch barbers din Supabase pentru user
  useEffect(() => {
    async function fetchBarbers() {
      const { data } = await supabase.from('barbers').select('*').order('name');
      if (data) setBarbers(data);
    }
    fetchBarbers();
  }, []);

  // Fetch & subscribe la servicii din Supabase
  useEffect(() => {
    let channel;
    async function fetchServices() {
      const { data } = await supabase.from('services').select('*').order('name');
      if (data) setServices(data);
    }
    fetchServices();
    channel = supabase.channel('realtime:services')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, payload => {
        fetchServices();
      })
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // Step 1: alegere specialist (folosește barbers din DB)
  // MODIFIC: Adaug și alegerea serviciului
  const handleChooseSpecialist = (spec) => {
    setSelectedSpecialist(spec);
    setStep(2);
  };
  const handleChooseService = (service) => {
    setSelectedService(service);
  };

  // Step 2: alegere dată/ora
  const handleChooseDate = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };
  const handleChooseSlot = (slot) => {
    setSelectedSlot(slot);
  };
  const handleConfirmDate = () => {
    if (selectedDate && selectedSlot) setStep(3);
  };

  // Step 3: formular
  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Previne submit-ul multiplu cu useRef pentru siguranță
    if (isSubmittingRef.current) {
      setSubmitAttempts(prev => prev + 1);
      setReservationStatus('duplicate');
      console.log('Submit already in progress, showing warning...');
      
      // Resetează warning-ul după 3 secunde
      setTimeout(() => {
        setReservationStatus(null);
      }, 3000);
      
      return;
    }
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setReservationStatus(null);
    setSubmitAttempts(0);
    
    try {
      console.log('Starting form submission...');
      
      // Verific dacă slotul este încă disponibil înainte de submit
      const { data: existingBookings } = await supabase
        .from('appointments')
        .select('*')
        .eq('barber_id', selectedSpecialist.id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .eq('hour', selectedSlot)
        .in('status', ['pending', 'accepted', 'confirmed']);
      
      if (existingBookings && existingBookings.length > 0) {
        console.log('Slot is no longer available');
        setReservationStatus('slot_occupied');
        return;
      }
      
      // Creez programarea în Supabase
      const { error } = await supabase.from('appointments').insert({
        user_name: formData.name,
        user_phone: formData.phone,
        user_email: formData.email ? formData.email : '',
        barber_id: selectedSpecialist.id, // uuid-ul real!
        service_id: selectedService?.id || null,
        service_name: selectedService?.name || null,
        date: format(selectedDate, 'yyyy-MM-dd'),
        hour: selectedSlot,
        status: 'accepted'
      });
      
      if (!error) {
        console.log('Appointment created successfully');
        setReservationStatus('success');
      } else {
        console.error('Error creating appointment:', error);
        setReservationStatus('error');
      }
    } catch (error) {
      console.error('Exception during form submission:', error);
      setReservationStatus('error');
    } finally {
      console.log('Form submission completed, resetting state...');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Calendar logic
  const daysOfMonth = getDaysOfMonth(calendarMonth);
  const weekDays = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"];
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Demo: sloturi ocupate random
  const busySlots = {
    [format(today, "yyyy-MM-dd")]: [ALL_SLOTS[0], ALL_SLOTS[1]],
    [format(addDays(today, 1), "yyyy-MM-dd")]: ["12:00"]
  };
  function isSlotBusy(date, slot) {
    const key = format(date, "yyyy-MM-dd");
    return busySlots[key]?.includes(slot);
  }

  // --- În componentă, definesc days, todayIdx și isOpenNow ---
  const days = [
    { label: 'Luni', hours: '09:00 - 21:00' },
    { label: 'Marți', hours: '09:00 - 21:00' },
    { label: 'Miercuri', hours: '09:00 - 21:00' },
    { label: 'Joi', hours: '09:00 - 21:00' },
    { label: 'Vineri', hours: '09:00 - 21:00' },
    { label: 'Sâmbătă', hours: '09:00 - 21:00' },
    { label: 'Duminică', hours: '09:00 - 21:00' },
  ];
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const now = new Date();
  const isOpenNow = (() => {
    const h = now.getHours(), m = now.getMinutes();
    return h >= 9 && (h < 21 || (h === 21 && m === 0));
  })();

  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/*" element={
          <div className="main-layout" onScroll={() => {}}>
            {/* Header elegant cu logo */}
            <header className="boom-header">
              <nav className="boom-nav">
                <a href="#services">SERVICII</a>
                <a href="#team">ECHIPA</a>
              </nav>
              <div className="boom-logo">
                <img src={logo} alt="BOOM Barbershop Logo" />
                <img 
                  src={logo2} 
                  alt="BOOM Barbershop Logo 2" 
                  className="boom-logo-scrolled"
                />
                <div className="boom-logo-text">
                  <h1 className="boom-logo-title">BOOM</h1>
                  <p className="boom-logo-subtitle">~Barbershop~</p>
                </div>
              </div>
              <nav className="boom-nav">
                <a href="#products">PRODUSE</a>
                <a href="#contact">CONTACT</a>
              </nav>
            </header>
            
            {/* Primul Screen - Hero complet */}
            <div className="hero-screen">
              <div className="hero-section">
                <p className="hero-subtitle-main">Barbershop</p>
                <p className="hero-description">
                  BOOM Barbershop București - frizerie premium lângă Plaza Mall, Timișoara 43. 
                  Oferim tunsori moderne și bărbierit tradițional într-un spațiu modern și accesibil. 
                  Echipa noastră de specialiști dedicați îți oferă servicii profesionale de cea mai înaltă calitate. 
                  Programare online simplă și rapidă pentru experiența perfectă de frizerie în București.
                </p>
              </div>
            </div>
            
            {/* Servicii stilizate */}
            <div className="services-section" id="services">
              <h3 className="services-title reveal">Servicii Frizerie București - BOOM Barbershop</h3>
              <div className="services-list-direct">
                {services.map(service => {
                  const discount = parseInt(service.discount_percent) > 0 ? parseInt(service.discount_percent) : 0;
                  const price = parseFloat(service.price);
                  const reduced = discount ? Math.round(price * (1 - discount / 100)) : price;
                  return (
                    <div className="service-item-direct" key={service.id}>
                      <div className="service-info">
                        <h4 className="service-name-direct">{service.name}</h4>
                        {service.description && (
                          <p className="service-desc-direct">{service.description}</p>
                        )}
                        <div className="service-price-direct">
                          <span className="service-price-main">{reduced} lei</span>
                          {discount ? (
                            <>
                              <span className="service-price-old">{price} lei</span>
                              <span className="service-discount">-{discount}%</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <button
                        className="service-book-btn"
                        onClick={() => {
                          setSelectedService(service);
                          setCalendarOpen(true);
                          setStep(1);
                        }}
                      >
                        Programează
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Zona Echipă */}
            <div className="team-section reveal" id="team">
              <h3 className="team-title">Echipa noastră</h3>
              <div className="team-placeholder">
                <p>În curând vom prezenta echipa noastră de specialiști dedicați.</p>
                <p>Fiecare membru al echipei BOOM este pasionat de arta frizeriei și dedicat să îți ofere cea mai bună experiență.</p>
              </div>
            </div>
            
            {/* Galerie foto - interior + freze */}
            <div className="gallery-section" id="galerie">
              <h3 className="gallery-title">Galerie</h3>
              <div className="gallery-grid reveal">
                <div className="gallery-card"><img src={require('./incapere1.jpg')} alt="Interior BOOM Barbershop" /></div>
                <div className="gallery-card"><img src={require('./incapere2.jpeg')} alt="Spațiu modern BOOM Barbershop" /></div>
                <div className="gallery-card"><img src={require('./freza1.jpg')} alt="Tunsori moderne BOOM Barbershop" /></div>
                <div className="gallery-card"><img src={require('./freza2.jpg')} alt="Servicii frizerie București" /></div>
                <div className="gallery-card"><img src={require('./freza3.jpg')} alt="Bărbierit tradițional BOOM" /></div>
                <div className="gallery-card"><img src={require('./freza4.jpg')} alt="Tunsori premium București" /></div>
                <div className="gallery-card"><img src={require('./freza5.jpg')} alt="Frizerie BOOM Barbershop" /></div>
                <div className="gallery-card"><img src={require('./freza6.jpg')} alt="Servicii profesionale București" /></div>
                <div className="gallery-card"><img src={require('./freza7.jpg')} alt="Echipa BOOM Barbershop" /></div>
              </div>
            </div>

            {/* Zona Contact cu hartă în dreapta */}
            <div className="contact-with-map">
              <div className="contact-section" id="contact">
              <div className="contact-header">
                <h3 className="contact-subtitle">CONTACT</h3>
                <h2 className="contact-main-title">BOOM Barbershop București</h2>
              </div>
                
                <div className="contact-content">
                  <div className="contact-details">
                    <div className="contact-address">
                      <p><strong>BOOM Barbershop București</strong></p>
                      <p>Bulevardul Timișoara 43, Bloc 34</p>
                      <p>București, Sector 1, România</p>
                      <p>Cod poștal: 061344</p>
                      <p><em>Lângă Plaza Mall București</em></p>
                    </div>
                    
                    <div className="contact-phone">
                      <p>0773980782</p>
                    </div>
                    
                    <div className="contact-email">
                      <p>boombarbershop2025@gmail.com</p>
                    </div>
                  </div>
                  
                  <div className="contact-hours">
                    <h4>Program de lucru</h4>
                    <div className="hours-list">
                      <p><strong>LUNI:</strong> 09:00 - 21:00</p>
                      <p><strong>MARȚI:</strong> 09:00 - 21:00</p>
                      <p><strong>MIERCURI:</strong> 09:00 - 21:00</p>
                      <p><strong>JOI:</strong> 09:00 - 21:00</p>
                      <p><strong>VINERI:</strong> 09:00 - 21:00</p>
                      <p><strong>SÂMBĂTĂ:</strong> 09:00 - 21:00</p>
                      <p><strong>DUMINICĂ:</strong> 09:00 - 21:00</p>
                    </div>
                  </div>
                </div>
                
                <div className="contact-social">
                  <div className="social-item">
                    <span>FACEBOOK</span>
                    <div className="social-bullet"></div>
                  </div>
                  <div className="social-item">
                    <span>INSTAGRAM</span>
                    <div className="social-bullet"></div>
                  </div>
                </div>
              </div>
              
              <aside className="contact-map-aside" aria-label="Harta Boom Barbershop">
                <div className="map-aside-inner">
                  <iframe
                    title="Boom Barbershop Map"
                    src="https://www.google.com/maps?width=100%25&height=600&hl=ro&q=Bulevardul%20Timi%C8%99oara%2043%2C%20Bloc%2034%2C%20Bucure%C8%99ti%20061344&t=&z=16&ie=UTF8&iwloc=B&output=embed"
                    allowFullScreen
                    loading="lazy"
                  ></iframe>
                </div>
              </aside>
            </div>

            {/* Calendar Modal */}
            {calendarOpen && (
              <div className="calendar-modal-overlay" onClick={handleCloseCalendar}>
                <div className="calendar-modal calendar-modal-big" onClick={e => e.stopPropagation()}>
                  <button className="calendar-modal-close" onClick={handleCloseCalendar}>×</button>
                  
                  {/* Stepper */}
                  <div className="calendar-stepper">
                    <span className={step >= 1 ? "active" : ""}>1</span>
                    <span className={step >= 2 ? "active" : ""}>2</span>
                    <span className={step >= 3 ? "active" : ""}>3</span>
                  </div>

                  {/* Step 1: Choose Specialist */}
                  {step === 1 && (
                    <div className="choose-specialist">
                      <h2 className="choose-title">Alege specialistul</h2>
                      <p className="choose-subtitle">Selectează frizerul preferat pentru programarea ta</p>
                      <div className="specialist-list">
                        {barbers.map(spec => (
                          <button
                            key={spec.id}
                            className={`specialist-btn${selectedSpecialist?.id === spec.id ? " selected" : ""}`}
                            onClick={() => handleChooseSpecialist(spec)}
                          >
                            {spec.avatar_url && (
                              <div className="spec-avatar">
                                <img src={spec.avatar_url} alt={spec.name} />
                              </div>
                            )}
                            <div className="spec-name-large">{spec.name}</div>
                            {spec.description && <div className="spec-desc">{spec.description}</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Choose Date & Slot */}
                  {step === 2 && (
                    <div className="choose-date">
                      <h2 className="choose-title">Alege data și ora</h2>
                      <p className="choose-subtitle">Pentru {selectedSpecialist?.name}</p>
                      
                      {/* Calendar Visual */}
                      <div className="calendar-date-visual">
                        <div className="calendar-date-header">
                          <button className="calendar-arrow" onClick={() => setCalendarMonth(addDays(calendarMonth, -1))}>‹</button>
                          <span className="calendar-month-label">{format(calendarMonth, "MMMM yyyy", {locale: ro})}</span>
                          <button className="calendar-arrow" onClick={() => setCalendarMonth(addDays(calendarMonth, 1))}>›</button>
                        </div>
                        
                        <div className="calendar-weekdays">
                          {weekDays.map(day => <span key={day}>{day}</span>)}
                        </div>
                        
                        <div className="calendar-days-grid">
                          {daysOfMonth.map(day => (
                            <button
                              key={day.toString()}
                              className={`calendar-day-btn2${isSameDay(day, selectedDate) ? " selected" : ""}${isToday(day) ? " today" : ""}${isBefore(day, todayStart) ? " disabled" : ""}`}
                              onClick={() => !isBefore(day, todayStart) && handleChooseDate(day)}
                              disabled={isBefore(day, todayStart)}
                            >
                              {format(day, "d")}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Selected Date Footer */}
                      {selectedDate && (
                        <div className="calendar-date-footer">
                          <span className="calendar-date-selected-label">
                            Data selectată: {format(selectedDate, "EEEE, d MMMM yyyy", {locale: ro})}
                          </span>
                          <button 
                            className="calendar-confirm-btn" 
                            onClick={handleConfirmDate}
                            disabled={!selectedSlot}
                          >
                            Confirmă data
                          </button>
                        </div>
                      )}

                      {/* Time Slots */}
                      {selectedDate && (
                        <CalendarUserSlots
                          selectedSpecialist={selectedSpecialist}
                          selectedDate={selectedDate}
                          selectedSlot={selectedSlot}
                          setSelectedSlot={handleChooseSlot}
                        />
                      )}

                      <button className="calendar-back" onClick={() => setStep(1)}>← Înapoi</button>
                    </div>
                  )}

                  {/* Step 3: Contact Form */}
                  {step === 3 && (
                    <div className="choose-form">
                      <h2 className="choose-title">Detalii contact</h2>
                      <p className="choose-subtitle">
                        Programare pentru {selectedSpecialist?.name} - {format(selectedDate, "EEEE, d MMMM", {locale: ro})} la {selectedSlot}
                      </p>
                      
                      {reservationStatus === 'success' && (
                        <div className="calendar-form-success">
                          Programarea a fost creată cu succes! Vei fi contactat în curând pentru confirmare.
                        </div>
                      )}
                      
                      {reservationStatus === 'error' && (
                        <div className="calendar-form-error">
                          A apărut o eroare la crearea programării. Te rugăm să încerci din nou.
                        </div>
                      )}
                      
                      {reservationStatus === 'slot_occupied' && (
                        <div className="calendar-form-error">
                          Acest slot nu mai este disponibil. Te rugăm să alegi altă oră.
                        </div>
                      )}
                      
                      {reservationStatus === 'duplicate' && (
                        <div className="calendar-form-warning">
                          Programarea a fost deja trimisă! Te rugăm să aștepți...
                        </div>
                      )}

                      <form className="calendar-form" onSubmit={handleFormSubmit}>
                        <input
                          type="text"
                          name="name"
                          placeholder="Numele tău"
                          value={formData.name}
                          onChange={handleFormChange}
                          required
                        />
                        <input
                          type="tel"
                          name="phone"
                          placeholder="Numărul de telefon"
                          value={formData.phone}
                          onChange={handleFormChange}
                          required
                        />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email (opțional)"
                          value={formData.email}
                          onChange={handleFormChange}
                        />
                        <button 
                          type="submit" 
                          className="calendar-confirm-btn"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Se procesează...' : 'Finalizează programarea'}
                        </button>
                      </form>

                      <button className="calendar-back" onClick={() => setStep(2)}>← Înapoi</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        } />
      </Routes>
    </Router>
  );
}

// CalendarUserSlots component pentru sloturi user cu greyed out
function CalendarUserSlots({ selectedSpecialist, selectedDate, selectedSlot, setSelectedSlot }) {
  const [bookings, setBookings] = useState([]);
  useEffect(() => {
    async function fetchBookings() {
      if (!selectedSpecialist || !selectedDate) return;
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('barber_id', selectedSpecialist.id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));
      if (data) setBookings(data);
    }
    fetchBookings();
  }, [selectedSpecialist, selectedDate]);
  function isSlotUnavailable(slot) {
    // Check if slot is booked
    const isBooked = bookings.some(b => b.hour === slot && (
      b.status === 'accepted' || b.status === 'confirmed' || b.status === 'pending' || b.status === 'pauza'
    ));
    
    // Check if slot is in the past for today
    const isInPast = isSameDay(selectedDate, new Date()) && isSlotInPast(slot);
    
    return isBooked || isInPast;
  }
  
  function isSlotInPast(slot) {
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Slot is in past if hour is less than current hour, or same hour but minute is less/equal
    return slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute);
  }
  return (
    <div className="calendar-slots-groups">
      {SLOT_GROUPS.map(group => (
        <div key={group.label} className="slot-group">
          <div className="slot-group-label">{group.label}</div>
          <div className="slot-group-slots">
            {ALL_SLOTS.filter(slot => {
              const hour = parseInt(slot.split(":")[0], 10);
              return hour >= group.range[0] && hour < group.range[1];
            }).map(slot => {
              const unavailable = isSlotUnavailable(slot);
              return (
                <button
                  key={slot}
                  className={`slot-btn2${selectedSlot === slot ? " selected" : ""}${unavailable ? " busy" : ""}`}
                  onClick={() => !unavailable && setSelectedSlot(slot)}
                  disabled={unavailable}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RequireAdmin({ children }) {
  const isAdmin = (localStorage.getItem("isAdmin") === "true") || (sessionStorage.getItem("isAdmin") === "true");
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAdmin) navigate("/admin", { replace: true });
  }, [isAdmin, navigate]);
  return isAdmin ? children : null;
}

export default App;
