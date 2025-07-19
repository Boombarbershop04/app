import React, { useState } from "react";
import { addDays, format, isSameDay, isBefore } from "date-fns";
import { ro } from "date-fns/locale";

const HOURS_START = 10;
const HOURS_END = 18;
const SLOT_MINUTES = 40;
const CAROUSEL_SIZE = 4;
const CALENDAR_DAYS = 60; // 2 luni

function generateTimeSlots() {
  const slots = [];
  for (let h = HOURS_START; h < HOURS_END; ++h) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const hour = h.toString().padStart(2, "0");
      const minute = m.toString().padStart(2, "0");
      slots.push(`${hour}:${minute}`);
    }
  }
  return slots;
}

const timeSlots = generateTimeSlots();

const busySlots = {
  [format(new Date(), "yyyy-MM-dd")]: [timeSlots[0], timeSlots[1]],
  [format(addDays(new Date(), 1), "yyyy-MM-dd")]: ["12:00"]
};

function isValidPhone(phone) {
  return /^((\+4)?07\d{8})$/.test(phone.trim());
}

function isValidName(name) {
  return /^[a-zA-ZăîâșțĂÎÂȘȚ\s'-]{2,}$/.test(name.trim());
}

export default function Calendar() {
  const today = new Date();
  // Generez 60 de zile de azi înainte
  const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i));
  const visibleDays = days;

  const [carouselIdx, setCarouselIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null); // Date
  const [selectedSlot, setSelectedSlot] = useState(null); // string
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [reservation, setReservation] = useState(null);
  const [formError, setFormError] = useState("");

  function openModal(day) {
    setSelectedDay(day);
    setModalOpen(true);
    setSelectedSlot(null);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedDay(null);
    setSelectedSlot(null);
  }

  function handleSlotSelect(slot) {
    setSelectedSlot(slot);
    setModalOpen(false);
    setTimeout(() => setFormModalOpen(true), 200);
  }

  function isSlotBusy(day, slot) {
    const key = format(day, "yyyy-MM-dd");
    return busySlots[key]?.includes(slot);
  }

  function isSlotInPast(day, slot) {
    if (!isSameDay(day, today)) return false;
    const [h, m] = slot.split(":").map(Number);
    const now = new Date();
    if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
      return true;
    }
    return false;
  }

  function closeFormModal() {
    setFormModalOpen(false);
    setSelectedDay(null);
    setSelectedSlot(null);
    setForm({ name: "", phone: "", email: "" });
    setFormError("");
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError("Numele și telefonul sunt obligatorii!");
      return;
    }
    if (!isValidName(form.name)) {
      setFormError("Numele trebuie să conțină doar litere și să fie de minim 2 caractere!");
      return;
    }
    if (!isValidPhone(form.phone)) {
      setFormError("Numărul de telefon nu este valid! Folosește formatul 07xxxxxxxx sau +407xxxxxxxx.");
      return;
    }
    setReservation({
      day: selectedDay,
      slot: selectedSlot,
      ...form
    });
    setFormModalOpen(false);
    setForm({ name: "", phone: "", email: "" });
    setFormError("");
  }

  // Carusel logic
  const maxIdx = Math.max(0, visibleDays.length - CAROUSEL_SIZE);
  const daysToShow = visibleDays.slice(carouselIdx, carouselIdx + CAROUSEL_SIZE);
  const canGoLeft = carouselIdx > 0;
  const canGoRight = carouselIdx < maxIdx && visibleDays.length > CAROUSEL_SIZE;

  return (
    <div className="calendar-premium">
      <div className="calendar-week-title">
        Alege o zi pentru programare:
      </div>
      <div className="calendar-carousel-row">
        <button
          className="carousel-arrow"
          onClick={() => canGoLeft && setCarouselIdx(i => Math.max(0, i - 1))}
          disabled={!canGoLeft}
          aria-label="Zile anterioare"
        >&#8592;</button>
        <div className="calendar-days-row">
          {daysToShow.map((day, idx) => (
            <button
              key={idx + carouselIdx}
              className={`calendar-day-btn${selectedDay && isSameDay(day, selectedDay) ? " selected" : ""}`}
              onClick={() => openModal(day)}
              title={format(day, "EEEE, dd MMMM yyyy", {locale: ro})}
            >
              <span className="calendar-day-name">{format(day, "EEE", {locale: ro})}</span>
              <span className="calendar-day-date">{format(day, "dd.MM")}</span>
            </button>
          ))}
        </div>
        <button
          className="carousel-arrow"
          onClick={() => canGoRight && setCarouselIdx(i => Math.min(maxIdx, i + 1))}
          disabled={!canGoRight}
          aria-label="Zile următoare"
        >&#8594;</button>
      </div>
      {modalOpen && (
        <div className="calendar-modal-overlay" onClick={closeModal}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-title">
              Alege interval orar pentru <b>{format(selectedDay, "EEEE, dd MMMM yyyy", {locale: ro})}</b>
            </div>
            <div className="calendar-modal-slots">
              {timeSlots.map(slot => {
                const busy = isSlotBusy(selectedDay, slot);
                const inPast = isSlotInPast(selectedDay, slot);
                if (inPast) return null;
                return (
                  <button
                    key={slot}
                    className={`slot-btn modal${selectedSlot === slot ? " selected" : ""}${busy ? " busy" : ""}`}
                    onClick={() => !busy && handleSlotSelect(slot)}
                    disabled={busy}
                    title={busy ? "Ocupat" : slot}
                  >
                    {slot} {busy ? "(ocupat)" : ""}
                  </button>
                );
              })}
            </div>
            <button className="calendar-modal-close" onClick={closeModal}>Închide</button>
          </div>
        </div>
      )}
      {formModalOpen && (
        <div className="calendar-modal-overlay" onClick={closeFormModal}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-title">
              Completează datele pentru rezervare<br />
              <span style={{fontSize: "1rem", fontWeight: 400}}>
                {format(selectedDay, "EEEE, dd MMMM yyyy", {locale: ro})}, {selectedSlot}
              </span>
            </div>
            <form className="calendar-form" onSubmit={handleFormSubmit}>
              <input
                type="text"
                name="name"
                placeholder="Nume*"
                value={form.name}
                onChange={handleFormChange}
                required
              />
              <input
                type="tel"
                name="phone"
                placeholder="Telefon*"
                value={form.phone}
                onChange={handleFormChange}
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Email (opțional)"
                value={form.email}
                onChange={handleFormChange}
              />
              {formError && <div className="calendar-form-error">{formError}</div>}
              <button type="submit" className="book-btn" style={{marginTop: "1.2rem"}}>Confirmă rezervarea</button>
            </form>
            <button className="calendar-modal-close" onClick={closeFormModal}>Renunță</button>
          </div>
        </div>
      )}
      {reservation && !formModalOpen && (
        <div className="calendar-selected-info">
          <b>Rezervare trimisă!</b><br />
          Nume: {reservation.name}<br />
          Telefon: {reservation.phone}<br />
          {reservation.email && <>Email: {reservation.email}<br /></>}
          Data: {format(reservation.day, "EEEE, dd MMMM yyyy", {locale: ro})}, ora {reservation.slot}
        </div>
      )}
    </div>
  );
} 