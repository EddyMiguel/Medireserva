// Sistema principal de reservas para pacientes
class BookingSystem {
    constructor() {
        this.currentStep = 1;
        this.selectedSpecialty = null;
        this.selectedDoctor = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.availableSlots = [];
        
        this.specialties = [];
        this.doctors = [];
        
        this.init();
    }

    async init() {
        await this.loadInitialData();
        this.setupEventListeners();
        this.setMinDate();
        this.updateNavigation();
    }

    // Cargar datos iniciales
    async loadInitialData() {
        try {
            await this.loadSpecialties();
            await this.updateStats();
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            this.showError('Error al cargar los datos. Por favor recarga la página.');
        }
    }

    // Cargar especialidades
    async loadSpecialties() {
        this.showLoading();
        try {
            const response = await fetch('/api/specialties');
            const data = await response.json();
            
            if (data.success) {
                this.specialties = data.data;
                this.renderSpecialties();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando especialidades:', error);
            this.showError('No se pudieron cargar las especialidades.');
        } finally {
            this.hideLoading();
        }
    }

    // Cargar doctores por especialidad
    async loadDoctors(specialtyId) {
        this.showLoading();
        try {
            const response = await fetch(`/api/doctors?specialty_id=${specialtyId}`);
            const data = await response.json();
            
            if (data.success) {
                this.doctors = data.data;
                this.renderDoctors();
                
                if (this.doctors.length === 0) {
                    this.showMessage('No hay doctores disponibles para esta especialidad.');
                }
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando doctores:', error);
            this.showError('No se pudieron cargar los doctores.');
        } finally {
            this.hideLoading();
        }
    }

    // Cargar horarios disponibles
    async loadAvailableSlots() {
        if (!this.selectedDoctor || !this.selectedDate) return;

        this.showLoading();
        try {
            const response = await fetch(`/api/doctors/${this.selectedDoctor.id}/availability?date=${this.selectedDate}`);
            const data = await response.json();
            
            if (data.success) {
                this.availableSlots = data.data.available_slots;
                this.renderTimeSlots();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando horarios:', error);
            this.showError('No se pudieron cargar los horarios disponibles.');
        } finally {
            this.hideLoading();
        }
    }

    // Renderizar especialidades
    renderSpecialties() {
        const container = document.getElementById('specialtiesGrid');
        
        if (this.specialties.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay especialidades disponibles.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.specialties.map(specialty => `
            <div class="specialty-card" data-specialty-id="${specialty.id}">
                <div class="specialty-icon">
                    <i class="fas ${specialty.icon || 'fa-stethoscope'}"></i>
                </div>
                <div class="specialty-name">${specialty.name}</div>
                <div class="specialty-description">${specialty.description || 'Consulta especializada'}</div>
            </div>
        `).join('');

        // Agregar event listeners
        container.querySelectorAll('.specialty-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectSpecialty(e.currentTarget);
            });
        });
    }

    // Renderizar doctores
    renderDoctors() {
        const container = document.getElementById('doctorsGrid');
        
        if (this.doctors.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay doctores disponibles para esta especialidad.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.doctors.map(doctor => `
            <div class="doctor-card" data-doctor-id="${doctor.id}">
                <div class="doctor-header">
                    <div class="doctor-avatar">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <div class="doctor-info">
                        <h4>${doctor.name}</h4>
                        <div class="doctor-specialty">${doctor.specialty_name}</div>
                    </div>
                </div>
                <div class="doctor-details">
                    <div class="doctor-detail">
                        <i class="fas fa-graduation-cap"></i>
                        <span>${doctor.experience_years} años exp.</span>
                    </div>
                    <div class="doctor-detail">
                        <i class="fas fa-clock"></i>
                        <span>${doctor.consultation_duration} min</span>
                    </div>
                    <div class="doctor-detail">
                        <i class="fas fa-phone"></i>
                        <span>${doctor.phone}</span>
                    </div>
                    <div class="doctor-detail">
                        <i class="fas fa-envelope"></i>
                        <span>${doctor.email}</span>
                    </div>
                </div>
                <div class="doctor-fee">
                    $${doctor.fee} USD
                </div>
            </div>
        `).join('');

        // Agregar event listeners
        container.querySelectorAll('.doctor-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectDoctor(e.currentTarget);
            });
        });
    }

    // Renderizar horarios
    renderTimeSlots() {
        const container = document.getElementById('timeSlotsGrid');
        
        if (this.availableSlots.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay horarios disponibles para esta fecha.</p>
                    <p>Por favor selecciona otra fecha.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.availableSlots.map(slot => `
            <div class="time-slot" data-time="${slot.time}">
                ${slot.display}
            </div>
        `).join('');

        // Agregar event listeners
        container.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                this.selectTime(e.currentTarget);
            });
        });
    }

    // Seleccionar especialidad
    selectSpecialty(card) {
        // Remover selección anterior
        document.querySelectorAll('.specialty-card').forEach(c => {
            c.classList.remove('selected');
        });

        // Agregar selección
        card.classList.add('selected');
        
        const specialtyId = card.getAttribute('data-specialty-id');
        const specialty = this.specialties.find(s => s.id == specialtyId);
        
        this.selectedSpecialty = specialty;
        this.selectedDoctor = null; // Reset doctor selection
        
        // Cargar doctores de esta especialidad
        this.loadDoctors(specialtyId);
        
        this.enableNextButton();
    }

    // Seleccionar doctor
    selectDoctor(card) {
        // Remover selección anterior
        document.querySelectorAll('.doctor-card').forEach(c => {
            c.classList.remove('selected');
        });

        // Agregar selección
        card.classList.add('selected');
        
        const doctorId = card.getAttribute('data-doctor-id');
        const doctor = this.doctors.find(d => d.id == doctorId);
        
        this.selectedDoctor = doctor;
        this.enableNextButton();
    }

    // Seleccionar horario
    selectTime(element) {
        // Remover selección anterior
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Agregar selección
        element.classList.add('selected');
        this.selectedTime = element.getAttribute('data-time');
        this.enableNextButton();
    }

    // Configurar event listeners
    setupEventListeners() {
        // Navegación entre pasos
        document.getElementById('prevBtn').addEventListener('click', () => {
            this.previousStep();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            this.nextStep();
        });

        document.getElementById('confirmBtn').addEventListener('click', () => {
            this.confirmBooking();
        });

        // Cambio de fecha
        document.getElementById('appointmentDate').addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            if (this.selectedDoctor) {
                this.loadAvailableSlots();
            }
            this.enableNextButton();
        });

        // Búsqueda de citas
        document.getElementById('searchAppointmentsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.searchAppointments();
        });

        // Modal actions
        document.getElementById('newBookingBtn').addEventListener('click', () => {
            this.resetBooking();
        });

        document.getElementById('printBtn').addEventListener('click', () => {
            window.print();
        });

        // Navegación del header
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.target.getAttribute('href');
                if (target.startsWith('#')) {
                    this.scrollToSection(target);
                }
            });
        });
    }

    // Navegación entre pasos
    nextStep() {
        if (this.currentStep < 4) {
            this.currentStep++;
            this.updateStepDisplay();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    updateStepDisplay() {
        // Ocultar todos los pasos
        document.querySelectorAll('.step-card').forEach(step => {
            step.classList.remove('active');
        });

        // Mostrar paso actual
        document.getElementById(`step${this.currentStep}`).classList.add('active');

        this.updateNavigation();
    }

    updateNavigation() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const confirmBtn = document.getElementById('confirmBtn');

        // Botón anterior
        prevBtn.disabled = this.currentStep === 1;

        // Botones siguiente/confirmar
        if (this.currentStep === 4) {
            nextBtn.style.display = 'none';
            confirmBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'flex';
            confirmBtn.style.display = 'none';
        }

        this.enableNextButton();
    }

    enableNextButton() {
        const nextBtn = document.getElementById('nextBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        
        let enabled = false;

        switch (this.currentStep) {
            case 1:
                enabled = !!this.selectedSpecialty;
                break;
            case 2:
                enabled = !!this.selectedDoctor;
                break;
            case 3:
                enabled = !!(this.selectedDate && this.selectedTime);
                break;
            case 4:
                enabled = this.validatePatientForm();
                break;
        }

        nextBtn.disabled = !enabled;
        confirmBtn.disabled = !enabled;
    }

    validatePatientForm() {
        const name = document.getElementById('patientName').value.trim();
        const email = document.getElementById('patientEmail').value.trim();
        const phone = document.getElementById('patientPhone').value.trim();

        return name && email && phone && this.isValidEmail(email);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Confirmar reserva
    async confirmBooking() {
        if (!this.validatePatientForm()) {
            this.showError('Por favor completa todos los campos obligatorios correctamente.');
            return;
        }

        const appointmentData = {
            doctor_id: this.selectedDoctor.id,
            patient_name: document.getElementById('patientName').value.trim(),
            patient_email: document.getElementById('patientEmail').value.trim(),
            patient_phone: document.getElementById('patientPhone').value.trim(),
            appointment_date: this.selectedDate,
            appointment_time: this.selectedTime,
            reason: document.getElementById('appointmentReason').value.trim(),
            notes: document.getElementById('additionalNotes').value.trim()
        };

        this.showLoading();
        try {
            const response = await fetch('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(appointmentData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showConfirmation(result.data.appointment);
                await this.updateStats();
            } else {
                throw new Error(result.error || 'Error al crear la cita');
            }
        } catch (error) {
            console.error('Error creando cita:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Buscar citas del paciente
    async searchAppointments() {
        const email = document.getElementById('searchEmail').value.trim();
        const phone = document.getElementById('searchPhone').value.trim();

        if (!email && !phone) {
            this.showError('Por favor ingresa al menos un email o teléfono.');
            return;
        }

        this.showLoading();
        try {
            const response = await fetch(`/api/patient/appointments?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}`);
            const result = await response.json();

            if (response.ok && result.success) {
                this.renderAppointments(result.data);
            } else {
                throw new Error(result.error || 'Error al buscar citas');
            }
        } catch (error) {
            console.error('Error buscando citas:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Renderizar citas del paciente
    renderAppointments(appointments) {
        const container = document.getElementById('appointmentsList');
        const resultsContainer = document.getElementById('appointmentsResults');

        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No se encontraron citas con los datos proporcionados.</p>
                </div>
            `;
        } else {
            container.innerHTML = appointments.map(appointment => `
                <div class="appointment-item">
                    <div class="appointment-info">
                        <h4>${appointment.doctor_name}</h4>
                        <div class="appointment-meta">
                            <span><i class="fas fa-calendar"></i> ${this.formatDate(appointment.appointment_date)}</span>
                            <span><i class="fas fa-clock"></i> ${appointment.appointment_time}</span>
                            <span><i class="fas fa-stethoscope"></i> ${appointment.specialty_name}</span>
                        </div>
                        ${appointment.reason ? `<p><strong>Motivo:</strong> ${appointment.reason}</p>` : ''}
                    </div>
                    <div class="appointment-status status-${appointment.status}">
                        ${this.getStatusText(appointment.status)}
                    </div>
                </div>
            `).join('');
        }

        resultsContainer.style.display = 'block';
    }

    // Mostrar confirmación
    showConfirmation(appointment) {
        const modal = document.getElementById('confirmationModal');
        const details = document.getElementById('appointmentDetails');
        
        details.innerHTML = `
            <div class="detail-item">
                <strong>Número de Cita:</strong>
                <span>#${appointment.id}</span>
            </div>
            <div class="detail-item">
                <strong>Doctor:</strong>
                <span>${appointment.doctor_name}</span>
            </div>
            <div class="detail-item">
                <strong>Especialidad:</strong>
                <span>${appointment.specialty_name}</span>
            </div>
            <div class="detail-item">
                <strong>Fecha:</strong>
                <span>${this.formatDate(appointment.appointment_date)}</span>
            </div>
            <div class="detail-item">
                <strong>Hora:</strong>
                <span>${appointment.appointment_time}</span>
            </div>
            <div class="detail-item">
                <strong>Paciente:</strong>
                <span>${appointment.patient_name}</span>
            </div>
            <div class="detail-item">
                <strong>Email:</strong>
                <span>${appointment.patient_email}</span>
            </div>
            <div class="detail-item">
                <strong>Teléfono:</strong>
                <span>${appointment.patient_phone}</span>
            </div>
            ${appointment.reason ? `
            <div class="detail-item">
                <strong>Motivo:</strong>
                <span>${appointment.reason}</span>
            </div>
            ` : ''}
        `;
        
        modal.style.display = 'flex';
    }

    // Resetear reserva
    resetBooking() {
        this.closeModal();
        
        // Reset selections
        this.currentStep = 1;
        this.selectedSpecialty = null;
        this.selectedDoctor = null;
        this.selectedDate = null;
        this.selectedTime = null;
        
        // Reset UI
        document.querySelectorAll('.specialty-card, .doctor-card, .time-slot').forEach(el => {
            el.classList.remove('selected');
        });
        
        document.getElementById('patientForm').reset();
        document.getElementById('appointmentDate').value = '';
        document.getElementById('timeSlotsGrid').innerHTML = '';
        
        this.updateStepDisplay();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    closeModal() {
        document.getElementById('confirmationModal').style.display = 'none';
    }

    // Utilidades
    setMinDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('appointmentDate').min = today;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    getStatusText(status) {
        const statusMap = {
            'confirmed': 'Confirmada',
            'pending': 'Pendiente',
            'cancelled': 'Cancelada',
            'completed': 'Completada',
            'no_show': 'No Presentado'
        };
        return statusMap[status] || status;
    }

    scrollToSection(sectionId) {
        const section = document.querySelector(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    async updateStats() {
        try {
            // Contar especialidades
            const specialtiesResponse = await fetch('/api/specialties');
            const specialtiesData = await specialtiesResponse.json();
            
            if (specialtiesData.success) {
                document.getElementById('specialtiesCount').textContent = specialtiesData.data.length;
            }

            // Contar doctores
            const doctorsResponse = await fetch('/api/doctors');
            const doctorsData = await doctorsResponse.json();
            
            if (doctorsData.success) {
                document.getElementById('doctorsCount').textContent = doctorsData.data.length;
            }

        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }

    // Manejo de UI
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    showMessage(message) {
        alert(message);
    }
}

// Inicializar el sistema cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.bookingSystem = new BookingSystem();
});