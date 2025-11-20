// Sistema del Panel para Doctores
class DoctorSystem {
    constructor() {
        this.currentTab = 'agenda';
        this.currentDoctor = null;
        this.currentDate = new Date();
        this.appointments = [];
        this.allDoctors = [];
        this.charts = {};
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setCurrentTime();
        await this.loadDoctors();
        this.showDoctorSelection();
        
        // Actualizar hora cada minuto
        setInterval(() => this.setCurrentTime(), 60000);
    }

    // Configurar event listeners
    setupEventListeners() {
        // Navegación entre tabs
        document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                this.showTab(tab);
            });
        });

        // Botones de acción
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        document.getElementById('prevDate').addEventListener('click', () => {
            this.changeDate(-1);
        });

        document.getElementById('nextDate').addEventListener('click', () => {
            this.changeDate(1);
        });

        // Vista de próximas citas
        document.querySelectorAll('.view-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const view = e.currentTarget.getAttribute('data-view');
                this.switchUpcomingView(view);
            });
        });

        // Navegación del calendario
        document.getElementById('prevMonth').addEventListener('click', () => {
            this.changeCalendarMonth(-1);
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            this.changeCalendarMonth(1);
        });

        // Filtros del historial
        document.getElementById('historyStatusFilter').addEventListener('change', () => {
            this.filterHistory();
        });

        document.getElementById('historyMonthFilter').addEventListener('change', () => {
            this.filterHistory();
        });

        document.getElementById('clearHistoryFilters').addEventListener('click', () => {
            this.clearHistoryFilters();
        });

        // Periodo de estadísticas
        document.getElementById('statsPeriod').addEventListener('change', () => {
            this.updateStatistics();
        });

        // Cerrar sesión
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Modales
        document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModals();
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });

        // Cambio de estado de cita
        document.getElementById('confirmStatusChange').addEventListener('click', () => {
            this.confirmStatusChange();
        });

        // Toggle menu móvil
        document.querySelector('.menu-toggle').addEventListener('click', () => {
            document.querySelector('.doctor-sidebar').classList.toggle('active');
        });
    }

    // Cargar lista de doctores
    async loadDoctors() {
        try {
            const response = await fetch('/api/doctors');
            const data = await response.json();
            
            if (data.success) {
                this.allDoctors = data.data;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando doctores:', error);
            this.showError('No se pudieron cargar los doctores');
        }
    }

    // Mostrar selección de doctor
    showDoctorSelection() {
        const selection = document.getElementById('doctorSelection');
        const doctorsList = document.getElementById('doctorsList');
        
        doctorsList.innerHTML = this.allDoctors.map(doctor => `
            <div class="doctor-selection-item" data-doctor-id="${doctor.id}">
                <div class="doctor-selection-avatar">
                    <i class="fas fa-user-md"></i>
                </div>
                <div class="doctor-selection-info">
                    <h4>${doctor.name}</h4>
                    <p>${doctor.specialty_name}</p>
                    <small>${doctor.email}</small>
                </div>
            </div>
        `).join('');

        // Agregar event listeners a los items
        doctorsList.querySelectorAll('.doctor-selection-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const doctorId = e.currentTarget.getAttribute('data-doctor-id');
                this.selectDoctor(doctorId);
            });
        });

        selection.style.display = 'flex';
    }

    // Seleccionar doctor
    async selectDoctor(doctorId) {
        const doctor = this.allDoctors.find(d => d.id == doctorId);
        if (!doctor) return;

        this.currentDoctor = doctor;
        
        // Guardar en localStorage
        localStorage.setItem('selectedDoctor', JSON.stringify(doctor));
        
        // Ocultar selección
        document.getElementById('doctorSelection').style.display = 'none';
        
        // Actualizar información en sidebar
        this.updateDoctorInfo();
        
        // Cargar datos iniciales
        await this.loadInitialData();
        this.showTab('agenda');
    }

    // Actualizar información del doctor en la UI
    updateDoctorInfo() {
        if (!this.currentDoctor) return;

        const doctorInfo = document.getElementById('doctorInfo');
        doctorInfo.innerHTML = `
            <div class="doctor-avatar">
                <i class="fas fa-user-md"></i>
            </div>
            <div class="doctor-details">
                <span class="doctor-name">${this.currentDoctor.name}</span>
                <span class="doctor-specialty">${this.currentDoctor.specialty_name}</span>
                <span class="doctor-id">ID: ${this.currentDoctor.id}</span>
            </div>
        `;

        // Actualizar perfil
        this.updateProfileInfo();
    }

    // Cargar datos iniciales del doctor
    async loadInitialData() {
        if (!this.currentDoctor) return;

        await Promise.all([
            this.loadAppointments(),
            this.updateStatistics()
        ]);
    }

    async refreshData() {
        this.showLoading();
        try {
            await this.loadInitialData();
            await this.showTab(this.currentTab);
            this.showSuccess('Datos actualizados correctamente');
        } catch (error) {
            this.showError('Error al actualizar los datos');
        } finally {
            this.hideLoading();
        }
    }

    // Cargar citas del doctor
    async loadAppointments() {
        if (!this.currentDoctor) return;

        try {
            const response = await fetch(`/api/doctors/${this.currentDoctor.id}/appointments`);
            const data = await response.json();
            
            if (data.success) {
                this.appointments = data.data;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando citas:', error);
            this.showError('No se pudieron cargar las citas');
        }
    }

    // Mostrar tab específico
    async showTab(tabName) {
        if (!this.currentDoctor) {
            this.showDoctorSelection();
            return;
        }

        // Actualizar navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Actualizar contenido
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Actualizar título
        document.getElementById('pageTitle').textContent = this.getTabTitle(tabName);

        // Cargar datos específicos del tab
        switch (tabName) {
            case 'agenda':
                await this.loadAgendaData();
                break;
            case 'proximas':
                await this.loadUpcomingData();
                break;
            case 'historial':
                await this.loadHistoryData();
                break;
            case 'estadisticas':
                await this.loadStatisticsData();
                break;
            case 'perfil':
                this.loadProfileData();
                break;
        }

        this.currentTab = tabName;
    }

    getTabTitle(tabName) {
        const titles = {
            'agenda': 'Agenda del Día',
            'proximas': 'Próximas Citas',
            'historial': 'Historial',
            'estadisticas': 'Estadísticas',
            'perfil': 'Mi Perfil'
        };
        return titles[tabName] || 'Panel del Doctor';
    }

    // ==================== AGENDA DEL DÍA ====================

    async loadAgendaData() {
        await this.loadAppointments();
        this.updateAgendaHeader();
        this.renderTimeline();
        this.renderTodayAppointments();
    }

    updateAgendaHeader() {
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = this.appointments.filter(apt => 
            apt.appointment_date === today
        );

        document.getElementById('todayAppointments').textContent = todayAppointments.length;
        document.getElementById('completedToday').textContent = 
            todayAppointments.filter(apt => apt.status === 'completed').length;
        document.getElementById('pendingToday').textContent = 
            todayAppointments.filter(apt => apt.status === 'pending' || apt.status === 'confirmed').length;

        this.updateCurrentDate();
    }

    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = 
            now.toLocaleDateString('es-ES', options);
    }

    setCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        const dayString = now.toLocaleDateString('es-ES', { 
            weekday: 'long' 
        });

        document.getElementById('currentTime').textContent = timeString;
        document.getElementById('currentDay').textContent = dayString;
    }

    renderTimeline() {
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = this.appointments.filter(apt => 
            apt.appointment_date === today
        ).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

        const timeline = document.getElementById('timelineAppointments');
        const hoursContainer = document.querySelector('.timeline-hours');

        // Generar horas del día
        hoursContainer.innerHTML = '';
        for (let hour = 8; hour <= 18; hour++) {
            const timeString = `${hour.toString().padStart(2, '0')}:00`;
            const hourElement = document.createElement('div');
            hourElement.className = 'timeline-slot';
            hourElement.innerHTML = `
                <div class="timeline-time">${timeString}</div>
                <div class="timeline-events"></div>
            `;
            hoursContainer.appendChild(hourElement);
        }

        // Agregar citas a la timeline
        timeline.innerHTML = '';
        todayAppointments.forEach(appointment => {
            const appointmentElement = document.createElement('div');
            appointmentElement.className = `timeline-appointment ${this.getAppointmentTimeClass(appointment)}`;
            appointmentElement.innerHTML = `
                <div class="appointment-patient">${appointment.patient_name}</div>
                <div class="appointment-time">${appointment.appointment_time}</div>
                <div class="appointment-reason">${appointment.reason || 'Consulta general'}</div>
            `;
            appointmentElement.addEventListener('click', () => {
                this.showAppointmentDetail(appointment);
            });
            timeline.appendChild(appointmentElement);
        });
    }

    getAppointmentTimeClass(appointment) {
        const now = new Date();
        const appointmentTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        
        if (appointmentTime < now) {
            return 'past';
        } else if (appointmentTime.getTime() - now.getTime() < 30 * 60 * 1000) { // 30 minutos
            return 'current';
        } else {
            return 'future';
        }
    }

    renderTodayAppointments() {
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = this.appointments.filter(apt => 
            apt.appointment_date === today
        ).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

        const container = document.getElementById('todayAppointmentsList');
        
        if (todayAppointments.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay citas programadas para hoy.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = todayAppointments.map(appointment => `
            <div class="appointment-card ${appointment.status}" data-appointment-id="${appointment.id}">
                <div class="appointment-header">
                    <div class="appointment-time">${appointment.appointment_time}</div>
                    <div class="appointment-status status-${appointment.status}">
                        ${this.getStatusText(appointment.status)}
                    </div>
                </div>
                <div class="appointment-patient">${appointment.patient_name}</div>
                <div class="appointment-meta">
                    <span><i class="fas fa-phone"></i> ${appointment.patient_phone}</span>
                    <span><i class="fas fa-envelope"></i> ${appointment.patient_email}</span>
                </div>
                ${appointment.reason ? `
                <div class="appointment-reason">
                    <i class="fas fa-sticky-note"></i> ${appointment.reason}
                </div>
                ` : ''}
            </div>
        `).join('');

        // Agregar event listeners
        container.querySelectorAll('.appointment-card').forEach(card => {
            card.addEventListener('click', () => {
                const appointmentId = card.getAttribute('data-appointment-id');
                const appointment = todayAppointments.find(apt => apt.id == appointmentId);
                if (appointment) {
                    this.showAppointmentDetail(appointment);
                }
            });
        });
    }

    // ==================== PRÓXIMAS CITAS ====================

    async loadUpcomingData() {
        await this.loadAppointments();
        this.renderUpcomingAppointments();
        this.renderCalendar();
    }

    renderUpcomingAppointments() {
        const today = new Date().toISOString().split('T')[0];
        const upcomingAppointments = this.appointments
            .filter(apt => apt.appointment_date >= today)
            .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || 
                            a.appointment_time.localeCompare(b.appointment_time));

        const container = document.getElementById('upcomingAppointmentsList');
        
        if (upcomingAppointments.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay citas programadas.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = upcomingAppointments.map(appointment => `
            <div class="appointment-card ${appointment.status}" data-appointment-id="${appointment.id}">
                <div class="appointment-header">
                    <div class="appointment-time">
                        ${this.formatDate(appointment.appointment_date)} - ${appointment.appointment_time}
                    </div>
                    <div class="appointment-status status-${appointment.status}">
                        ${this.getStatusText(appointment.status)}
                    </div>
                </div>
                <div class="appointment-patient">${appointment.patient_name}</div>
                <div class="appointment-meta">
                    <span><i class="fas fa-phone"></i> ${appointment.patient_phone}</span>
                    <span><i class="fas fa-envelope"></i> ${appointment.patient_email}</span>
                </div>
                ${appointment.reason ? `
                <div class="appointment-reason">
                    <i class="fas fa-sticky-note"></i> ${appointment.reason}
                </div>
                ` : ''}
            </div>
        `).join('');

        // Agregar event listeners
        container.querySelectorAll('.appointment-card').forEach(card => {
            card.addEventListener('click', () => {
                const appointmentId = card.getAttribute('data-appointment-id');
                const appointment = upcomingAppointments.find(apt => apt.id == appointmentId);
                if (appointment) {
                    this.showAppointmentDetail(appointment);
                }
            });
        });
    }

    renderCalendar() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        this.renderCalendarMonth(currentYear, currentMonth);
    }

    renderCalendarMonth(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const calendarGrid = document.getElementById('calendarGrid');
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;

        // Días de la semana
        const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        let calendarHTML = '';

        // Encabezados de días
        daysOfWeek.forEach(day => {
            calendarHTML += `<div class="calendar-day">${day}</div>`;
        });

        // Fechas
        const currentDate = new Date(startDate);
        for (let i = 0; i < 42; i++) { // 6 semanas
            const dateString = currentDate.toISOString().split('T')[0];
            const hasAppointments = this.appointments.some(apt => 
                apt.appointment_date === dateString
            );
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const isCurrentMonth = currentDate.getMonth() === month;

            let className = 'calendar-date';
            if (!isCurrentMonth) className += ' other-month';
            if (isToday) className += ' today';
            if (hasAppointments) className += ' has-appointments';

            calendarHTML += `
                <div class="${className}" data-date="${dateString}">
                    ${currentDate.getDate()}
                </div>
            `;

            currentDate.setDate(currentDate.getDate() + 1);
        }

        calendarGrid.innerHTML = calendarHTML;

        // Agregar event listeners a las fechas
        calendarGrid.querySelectorAll('.calendar-date').forEach(dateElement => {
            dateElement.addEventListener('click', () => {
                const date = dateElement.getAttribute('data-date');
                this.showDateAppointments(date);
            });
        });
    }

    switchUpcomingView(view) {
        document.querySelectorAll('.view-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        document.getElementById('upcomingListView').classList.toggle('hidden', view !== 'list');
        document.getElementById('upcomingCalendarView').classList.toggle('hidden', view !== 'calendar');
    }

    changeCalendarMonth(delta) {
        const currentText = document.getElementById('calendarMonth').textContent;
        const [monthName, year] = currentText.split(' ');
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        let currentMonth = monthNames.indexOf(monthName);
        let currentYear = parseInt(year);

        currentMonth += delta;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        } else if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }

        this.renderCalendarMonth(currentYear, currentMonth);
    }

    // ==================== HISTORIAL ====================

    async loadHistoryData() {
        await this.loadAppointments();
        this.renderHistoryTable();
    }

    renderHistoryTable() {
        const tbody = document.querySelector('#historyTable tbody');
        const filteredAppointments = this.getFilteredHistory();
        
        if (filteredAppointments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <p>No hay citas en el historial que coincidan con los filtros.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredAppointments.map(appointment => `
            <tr>
                <td>${this.formatDate(appointment.appointment_date)}</td>
                <td>${appointment.appointment_time}</td>
                <td>
                    <strong>${appointment.patient_name}</strong><br>
                    <small>${appointment.patient_email}</small>
                </td>
                <td>${appointment.patient_phone}</td>
                <td>${appointment.reason || 'Consulta general'}</td>
                <td>
                    <span class="status-badge status-${appointment.status}">
                        ${this.getStatusText(appointment.status)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="doctorSystem.showAppointmentDetail(${appointment.id})">
                        <i class="fas fa-eye"></i> Ver
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getFilteredHistory() {
        let filtered = [...this.appointments];
        const statusFilter = document.getElementById('historyStatusFilter').value;
        const monthFilter = document.getElementById('historyMonthFilter').value;

        if (statusFilter) {
            filtered = filtered.filter(apt => apt.status === statusFilter);
        }

        if (monthFilter) {
            filtered = filtered.filter(apt => 
                apt.appointment_date.startsWith(monthFilter)
            );
        }

        return filtered.sort((a, b) => 
            b.appointment_date.localeCompare(a.appointment_date) || 
            b.appointment_time.localeCompare(a.appointment_time)
        );
    }

    filterHistory() {
        this.renderHistoryTable();
    }

    clearHistoryFilters() {
        document.getElementById('historyStatusFilter').value = '';
        document.getElementById('historyMonthFilter').value = '';
        this.renderHistoryTable();
    }

    // ==================== ESTADÍSTICAS ====================

    async loadStatisticsData() {
        await this.loadAppointments();
        this.updateStatistics();
    }

    updateStatistics() {
        const totalAppointments = this.appointments.length;
        const completedAppointments = this.appointments.filter(apt => apt.status === 'completed').length;
        const cancelledAppointments = this.appointments.filter(apt => apt.status === 'cancelled').length;
        const noShowAppointments = this.appointments.filter(apt => apt.status === 'no_show').length;

        const cancellationRate = totalAppointments > 0 ? 
            Math.round((cancelledAppointments / totalAppointments) * 100) : 0;
        const noShowRate = totalAppointments > 0 ? 
            Math.round((noShowAppointments / totalAppointments) * 100) : 0;

        document.getElementById('statsTotalAppointments').textContent = totalAppointments;
        document.getElementById('statsCompleted').textContent = completedAppointments;
        document.getElementById('statsCancellationRate').textContent = `${cancellationRate}%`;
        document.getElementById('statsNoShowRate').textContent = `${noShowRate}%`;

        this.renderCharts();
    }

    renderCharts() {
        this.renderAppointmentsChart();
        this.renderMonthlyChart();
        this.renderHoursChart();
    }

    renderAppointmentsChart() {
        const ctx = document.getElementById('doctorAppointmentsChart').getContext('2d');
        
        const statusCounts = {
            confirmed: this.appointments.filter(a => a.status === 'confirmed').length,
            pending: this.appointments.filter(a => a.status === 'pending').length,
            completed: this.appointments.filter(a => a.status === 'completed').length,
            cancelled: this.appointments.filter(a => a.status === 'cancelled').length,
            no_show: this.appointments.filter(a => a.status === 'no_show').length
        };

        if (this.charts.appointments) {
            this.charts.appointments.destroy();
        }

        this.charts.appointments = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Confirmadas', 'Pendientes', 'Completadas', 'Canceladas', 'No Presentado'],
                datasets: [{
                    data: [
                        statusCounts.confirmed,
                        statusCounts.pending,
                        statusCounts.completed,
                        statusCounts.cancelled,
                        statusCounts.no_show
                    ],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#2563eb',
                        '#ef4444',
                        '#6b7280'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderMonthlyChart() {
        const ctx = document.getElementById('doctorMonthlyChart').getContext('2d');
        
        // Agrupar citas por mes
        const monthlyData = {};
        this.appointments.forEach(apt => {
            const month = apt.appointment_date.substring(0, 7); // YYYY-MM
            monthlyData[month] = (monthlyData[month] || 0) + 1;
        });

        const months = Object.keys(monthlyData).sort();
        const counts = months.map(month => monthlyData[month]);

        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months.map(month => {
                    const [year, monthNum] = month.split('-');
                    return `${this.getMonthName(parseInt(monthNum) - 1)} ${year}`;
                }),
                datasets: [{
                    label: 'Citas por Mes',
                    data: counts,
                    backgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderHoursChart() {
        const ctx = document.getElementById('doctorHoursChart').getContext('2d');
        
        // Agrupar citas por hora
        const hourCounts = {};
        this.appointments.forEach(apt => {
            const hour = apt.appointment_time.substring(0, 2); // HH
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const hours = Object.keys(hourCounts).sort();
        const counts = hours.map(hour => hourCounts[hour]);

        if (this.charts.hours) {
            this.charts.hours.destroy();
        }

        this.charts.hours = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours.map(hour => `${hour}:00`),
                datasets: [{
                    label: 'Citas por Hora',
                    data: counts,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // ==================== PERFIL ====================

    loadProfileData() {
        this.updateProfileInfo();
    }

    updateProfileInfo() {
        if (!this.currentDoctor) return;

        document.getElementById('profileName').textContent = this.currentDoctor.name;
        document.getElementById('profileSpecialty').textContent = this.currentDoctor.specialty_name;
        document.getElementById('profileEmail').textContent = this.currentDoctor.email;
        document.getElementById('profilePhone').textContent = this.currentDoctor.phone;
        document.getElementById('profileExperience').textContent = `${this.currentDoctor.experience_years} años`;
        document.getElementById('profileFee').textContent = `$${this.currentDoctor.fee} USD`;
        document.getElementById('profileSchedule').textContent = 
            `${this.currentDoctor.working_hours_start} - ${this.currentDoctor.working_hours_end}`;
        document.getElementById('profileDuration').textContent = `${this.currentDoctor.consultation_duration} minutos`;
        document.getElementById('profileDays').textContent = this.getWorkingDaysText(this.currentDoctor.available_days);
        document.getElementById('profileBio').textContent = this.currentDoctor.bio || 'No hay biografía disponible.';
        document.getElementById('profileStatus').textContent = this.currentDoctor.is_active ? 'Activo' : 'Inactivo';
    }

    getWorkingDaysText(daysString) {
        const daysMap = {
            '1': 'Lunes',
            '2': 'Martes', 
            '3': 'Miércoles',
            '4': 'Jueves',
            '5': 'Viernes',
            '6': 'Sábado',
            '7': 'Domingo'
        };
        
        if (!daysString) return 'Lunes a Viernes';
        
        return daysString.split(',').map(day => daysMap[day] || day).join(', ');
    }

    // ==================== GESTIÓN DE CITAS ====================

    async showAppointmentDetail(appointment) {
        const modal = document.getElementById('appointmentDetailModal');
        const content = document.getElementById('appointmentDetailContent');
        const actions = document.getElementById('appointmentActions');

        content.innerHTML = `
            <div class="detail-item">
                <strong>ID de Cita:</strong>
                <span>#${appointment.id}</span>
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
            <div class="detail-item">
                <strong>Fecha:</strong>
                <span>${this.formatDate(appointment.appointment_date)}</span>
            </div>
            <div class="detail-item">
                <strong>Hora:</strong>
                <span>${appointment.appointment_time}</span>
            </div>
            <div class="detail-item">
                <strong>Estado:</strong>
                <span class="status-badge status-${appointment.status}">
                    ${this.getStatusText(appointment.status)}
                </span>
            </div>
            ${appointment.reason ? `
            <div class="detail-item">
                <strong>Motivo:</strong>
                <span>${appointment.reason}</span>
            </div>
            ` : ''}
            ${appointment.notes ? `
            <div class="detail-item">
                <strong>Notas:</strong>
                <span>${appointment.notes}</span>
            </div>
            ` : ''}
            <div class="detail-item">
                <strong>Creado:</strong>
                <span>${this.formatDateTime(appointment.created_at)}</span>
            </div>
        `;

        // Mostrar acciones según el estado
        let actionHTML = '';
        if (appointment.status === 'confirmed' || appointment.status === 'pending') {
            actionHTML = `
                <button class="btn btn-primary" onclick="doctorSystem.openStatusModal(${appointment.id}, 'completed')">
                    <i class="fas fa-check-circle"></i> Marcar como Completada
                </button>
                <button class="btn btn-outline" onclick="doctorSystem.openStatusModal(${appointment.id}, 'cancelled')">
                    <i class="fas fa-times-circle"></i> Cancelar Cita
                </button>
            `;
        } else if (appointment.status === 'completed') {
            actionHTML = '<p class="text-muted">Esta cita ya ha sido completada.</p>';
        } else if (appointment.status === 'cancelled') {
            actionHTML = '<p class="text-muted">Esta cita ha sido cancelada.</p>';
        }

        actions.innerHTML = actionHTML;

        modal.classList.add('active');
    }

    openStatusModal(appointmentId, newStatus) {
        this.currentAppointmentId = appointmentId;
        this.newStatus = newStatus;

        const modal = document.getElementById('statusModal');
        const message = document.getElementById('statusModalMessage');
        
        const statusText = {
            'completed': 'completada',
            'cancelled': 'cancelada', 
            'no_show': 'no presentado'
        }[newStatus];

        message.textContent = `¿Estás seguro de que quieres marcar esta cita como ${statusText}?`;

        // Resaltar la opción seleccionada
        document.querySelectorAll('.status-option').forEach(option => {
            option.classList.remove('selected');
            if (option.getAttribute('data-status') === newStatus) {
                option.classList.add('selected');
            }
        });

        modal.classList.add('active');
    }

    async confirmStatusChange() {
        if (!this.currentAppointmentId || !this.newStatus) return;

        this.showLoading();
        try {
            const response = await fetch(`/api/appointments/${this.currentAppointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: this.newStatus })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess('Estado de la cita actualizado correctamente');
                this.closeModals();
                await this.loadAppointments();
                
                // Recargar la vista actual
                await this.showTab(this.currentTab);
            } else {
                throw new Error(result.error || 'Error al actualizar el estado');
            }
        } catch (error) {
            console.error('Error actualizando estado:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    // ==================== UTILIDADES ====================

    changeDate(delta) {
        this.currentDate.setDate(this.currentDate.getDate() + delta);
        this.updateCurrentDate();
        this.loadAgendaData();
    }

    showDateAppointments(date) {
        alert(`Citas para ${this.formatDate(date)} - Funcionalidad en desarrollo`);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES');
    }

    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('es-ES');
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

    getMonthName(monthIndex) {
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return months[monthIndex];
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        this.currentAppointmentId = null;
        this.newStatus = null;
    }

    logout() {
        localStorage.removeItem('selectedDoctor');
        this.currentDoctor = null;
        this.showDoctorSelection();
    }

    // Verificar si hay un doctor seleccionado al cargar la página
    checkStoredDoctor() {
        const storedDoctor = localStorage.getItem('selectedDoctor');
        if (storedDoctor) {
            this.currentDoctor = JSON.parse(storedDoctor);
            this.updateDoctorInfo();
            this.loadInitialData();
            this.showTab('agenda');
            return true;
        }
        return false;
    }

    // Manejo de UI
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    showSuccess(message) {
        // En una implementación real, usarías un toast notification
        alert(`✅ ${message}`);
    }

    showError(message) {
        alert(`❌ ${message}`);
    }
}

// Inicializar el sistema del doctor
document.addEventListener('DOMContentLoaded', () => {
    window.doctorSystem = new DoctorSystem();
    
    // Verificar si hay un doctor almacenado
    setTimeout(() => {
        if (!doctorSystem.checkStoredDoctor()) {
            doctorSystem.showDoctorSelection();
        }
    }, 100);
});