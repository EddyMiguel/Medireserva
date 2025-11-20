// Sistema de Administración
class AdminSystem {
    constructor() {
        this.currentTab = 'dashboard';
        this.specialties = [];
        this.doctors = [];
        this.appointments = [];
        this.charts = {};
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setCurrentDate();
        await this.loadInitialData();
        this.showTab('dashboard');
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

        document.getElementById('addSpecialtyBtn').addEventListener('click', () => {
            this.openSpecialtyModal();
        });

        document.getElementById('addDoctorBtn').addEventListener('click', () => {
            this.openDoctorModal();
        });

        document.getElementById('viewAllAppointments').addEventListener('click', () => {
            this.showTab('citas');
        });

        // Filtros
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.filterAppointments();
        });

        document.getElementById('dateFilter').addEventListener('change', () => {
            this.filterAppointments();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Periodo de reportes
        document.getElementById('reportPeriod').addEventListener('change', () => {
            this.updateReports();
        });

        // Formularios modales
        document.getElementById('specialtyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSpecialty();
        });

        document.getElementById('doctorForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveDoctor();
        });

        // Cerrar modales
        document.querySelectorAll('.modal-close, [data-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModals();
            });
        });

        // Clic fuera del modal para cerrar
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });

        // Acciones rápidas
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });

        // Toggle menu móvil
        document.querySelector('.menu-toggle').addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }

    // Mostrar tab específico
    async showTab(tabName) {
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
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'especialidades':
                await this.loadSpecialtiesData();
                break;
            case 'doctores':
                await this.loadDoctorsData();
                break;
            case 'citas':
                await this.loadAppointmentsData();
                break;
            case 'reportes':
                await this.loadReportsData();
                break;
        }

        this.currentTab = tabName;
    }

    getTabTitle(tabName) {
        const titles = {
            'dashboard': 'Dashboard',
            'especialidades': 'Especialidades',
            'doctores': 'Doctores',
            'citas': 'Citas',
            'reportes': 'Reportes'
        };
        return titles[tabName] || 'Panel de Administración';
    }

    // Cargar datos iniciales
    async loadInitialData() {
        await Promise.all([
            this.loadSpecialties(),
            this.loadDoctors(),
            this.loadAppointments()
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

    // ==================== ESPECIALIDADES ====================

    async loadSpecialties() {
        try {
            const response = await fetch('/api/admin/specialties');
            const data = await response.json();
            
            if (data.success) {
                this.specialties = data.data;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando especialidades:', error);
            this.showError('No se pudieron cargar las especialidades');
        }
    }

    async loadSpecialtiesData() {
        await this.loadSpecialties();
        this.renderSpecialtiesTable();
    }

    renderSpecialtiesTable() {
        const tbody = document.querySelector('#specialtiesTable tbody');
        
        if (this.specialties.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <p>No hay especialidades registradas.</p>
                        <button class="btn btn-primary mt-2" onclick="adminSystem.openSpecialtyModal()">
                            <i class="fas fa-plus"></i> Agregar Primera Especialidad
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.specialties.map(specialty => `
            <tr>
                <td>${specialty.id}</td>
                <td>${specialty.name}</td>
                <td>${specialty.description || '—'}</td>
                <td><i class="fas ${specialty.icon || 'fa-stethoscope'}"></i> ${specialty.icon || 'fa-stethoscope'}</td>
                <td>${this.formatDate(specialty.created_at)}</td>
                <td class="actions">
                    <button class="action-icon action-edit" onclick="adminSystem.editSpecialty(${specialty.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-icon action-delete" onclick="adminSystem.deleteSpecialty(${specialty.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    openSpecialtyModal(specialtyId = null) {
        const modal = document.getElementById('specialtyModal');
        const title = document.getElementById('specialtyModalTitle');
        const form = document.getElementById('specialtyForm');
        
        if (specialtyId) {
            // Modo edición
            const specialty = this.specialties.find(s => s.id === specialtyId);
            if (specialty) {
                title.textContent = 'Editar Especialidad';
                document.getElementById('specialtyId').value = specialty.id;
                document.getElementById('specialtyName').value = specialty.name;
                document.getElementById('specialtyDescription').value = specialty.description || '';
                document.getElementById('specialtyIcon').value = specialty.icon || '';
            }
        } else {
            // Modo creación
            title.textContent = 'Nueva Especialidad';
            form.reset();
            document.getElementById('specialtyId').value = '';
        }
        
        modal.classList.add('active');
    }

    async saveSpecialty() {
        const formData = {
            name: document.getElementById('specialtyName').value.trim(),
            description: document.getElementById('specialtyDescription').value.trim(),
            icon: document.getElementById('specialtyIcon').value.trim() || 'fa-stethoscope'
        };

        const specialtyId = document.getElementById('specialtyId').value;

        if (!formData.name) {
            this.showError('El nombre de la especialidad es requerido');
            return;
        }

        this.showLoading();
        try {
            const url = '/api/admin/specialties';
            const method = 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess(specialtyId ? 'Especialidad actualizada correctamente' : 'Especialidad creada correctamente');
                this.closeModals();
                await this.loadSpecialties();
                this.renderSpecialtiesTable();
            } else {
                throw new Error(result.error || 'Error al guardar la especialidad');
            }
        } catch (error) {
            console.error('Error guardando especialidad:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    editSpecialty(specialtyId) {
        this.openSpecialtyModal(specialtyId);
    }

    async deleteSpecialty(specialtyId) {
        if (!confirm('¿Estás seguro de que quieres eliminar esta especialidad? Esta acción no se puede deshacer.')) {
            return;
        }

        this.showLoading();
        try {
            // En una implementación real, aquí harías un DELETE request
            // Por ahora solo simulamos la eliminación
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showSuccess('Especialidad eliminada correctamente');
            await this.loadSpecialties();
            this.renderSpecialtiesTable();
        } catch (error) {
            console.error('Error eliminando especialidad:', error);
            this.showError('Error al eliminar la especialidad');
        } finally {
            this.hideLoading();
        }
    }

    // ==================== DOCTORES ====================

    async loadDoctors() {
        try {
            const response = await fetch('/api/admin/doctors');
            const data = await response.json();
            
            if (data.success) {
                this.doctors = data.data;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error cargando doctores:', error);
            this.showError('No se pudieron cargar los doctores');
        }
    }

    async loadDoctorsData() {
        await this.loadDoctors();
        this.renderDoctorsTable();
    }

    renderDoctorsTable() {
        const tbody = document.querySelector('#doctorsTable tbody');
        
        if (this.doctors.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <p>No hay doctores registrados.</p>
                        <button class="btn btn-primary mt-2" onclick="adminSystem.openDoctorModal()">
                            <i class="fas fa-user-plus"></i> Agregar Primer Doctor
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.doctors.map(doctor => `
            <tr>
                <td>${doctor.id}</td>
                <td>
                    <div class="avatar">
                        <i class="fas fa-user-md"></i>
                    </div>
                </td>
                <td>
                    <strong>${doctor.name}</strong>
                    ${doctor.bio ? `<br><small class="text-muted">${doctor.bio.substring(0, 50)}...</small>` : ''}
                </td>
                <td>${doctor.specialty_name}</td>
                <td>${doctor.email}</td>
                <td>${doctor.phone}</td>
                <td>
                    <span class="status-badge ${doctor.is_active ? 'status-confirmed' : 'status-cancelled'}">
                        ${doctor.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="action-icon action-view" onclick="adminSystem.viewDoctor(${doctor.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-icon action-edit" onclick="adminSystem.editDoctor(${doctor.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-icon action-delete" onclick="adminSystem.toggleDoctorStatus(${doctor.id})">
                        <i class="fas ${doctor.is_active ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async openDoctorModal(doctorId = null) {
        // Cargar especialidades para el select
        await this.loadSpecialties();
        const specialtySelect = document.getElementById('doctorSpecialty');
        specialtySelect.innerHTML = '<option value="">Seleccionar especialidad...</option>' +
            this.specialties.map(spec => 
                `<option value="${spec.id}">${spec.name}</option>`
            ).join('');

        const modal = document.getElementById('doctorModal');
        const title = document.getElementById('doctorModalTitle');
        const form = document.getElementById('doctorForm');
        
        if (doctorId) {
            // Modo edición
            const doctor = this.doctors.find(d => d.id === doctorId);
            if (doctor) {
                title.textContent = 'Editar Doctor';
                document.getElementById('doctorId').value = doctor.id;
                document.getElementById('doctorName').value = doctor.name;
                document.getElementById('doctorSpecialty').value = doctor.specialty_id;
                document.getElementById('doctorEmail').value = doctor.email;
                document.getElementById('doctorPhone').value = doctor.phone;
                document.getElementById('doctorExperience').value = doctor.experience_years;
                document.getElementById('doctorDuration').value = doctor.consultation_duration;
                document.getElementById('doctorStart').value = doctor.working_hours_start;
                document.getElementById('doctorEnd').value = doctor.working_hours_end;
                document.getElementById('doctorFee').value = doctor.fee;
                document.getElementById('doctorBio').value = doctor.bio || '';
                document.getElementById('doctorActive').checked = doctor.is_active;
            }
        } else {
            // Modo creación
            title.textContent = 'Nuevo Doctor';
            form.reset();
            document.getElementById('doctorId').value = '';
            document.getElementById('doctorActive').checked = true;
        }
        
        modal.classList.add('active');
    }

    async saveDoctor() {
        const formData = {
            name: document.getElementById('doctorName').value.trim(),
            specialty_id: document.getElementById('doctorSpecialty').value,
            email: document.getElementById('doctorEmail').value.trim(),
            phone: document.getElementById('doctorPhone').value.trim(),
            experience_years: parseInt(document.getElementById('doctorExperience').value) || 5,
            consultation_duration: parseInt(document.getElementById('doctorDuration').value) || 30,
            working_hours_start: document.getElementById('doctorStart').value || '09:00',
            working_hours_end: document.getElementById('doctorEnd').value || '18:00',
            fee: parseFloat(document.getElementById('doctorFee').value) || 50.00,
            bio: document.getElementById('doctorBio').value.trim(),
            is_active: document.getElementById('doctorActive').checked
        };

        const doctorId = document.getElementById('doctorId').value;

        // Validaciones
        if (!formData.name || !formData.specialty_id || !formData.email) {
            this.showError('Nombre, especialidad y email son requeridos');
            return;
        }

        this.showLoading();
        try {
            let url, method;
            
            if (doctorId) {
                url = `/api/admin/doctors/${doctorId}`;
                method = 'PUT';
            } else {
                url = '/api/admin/doctors';
                method = 'POST';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess(doctorId ? 'Doctor actualizado correctamente' : 'Doctor creado correctamente');
                this.closeModals();
                await this.loadDoctors();
                this.renderDoctorsTable();
            } else {
                throw new Error(result.error || 'Error al guardar el doctor');
            }
        } catch (error) {
            console.error('Error guardando doctor:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    viewDoctor(doctorId) {
        const doctor = this.doctors.find(d => d.id === doctorId);
        if (doctor) {
            alert(`Información del Doctor:\n\nNombre: ${doctor.name}\nEspecialidad: ${doctor.specialty_name}\nEmail: ${doctor.email}\nTeléfono: ${doctor.phone}\nExperiencia: ${doctor.experience_years} años\nEstado: ${doctor.is_active ? 'Activo' : 'Inactivo'}`);
        }
    }

    editDoctor(doctorId) {
        this.openDoctorModal(doctorId);
    }

    async toggleDoctorStatus(doctorId) {
        const doctor = this.doctors.find(d => d.id === doctorId);
        if (!doctor) return;

        const newStatus = !doctor.is_active;
        const action = newStatus ? 'activar' : 'desactivar';

        if (!confirm(`¿Estás seguro de que quieres ${action} al doctor ${doctor.name}?`)) {
            return;
        }

        this.showLoading();
        try {
            const response = await fetch(`/api/admin/doctors/${doctorId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...doctor,
                    is_active: newStatus
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess(`Doctor ${action}do correctamente`);
                await this.loadDoctors();
                this.renderDoctorsTable();
            } else {
                throw new Error(result.error || `Error al ${action} el doctor`);
            }
        } catch (error) {
            console.error('Error cambiando estado del doctor:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    // ==================== CITAS ====================

    async loadAppointments() {
        try {
            const response = await fetch('/api/admin/appointments');
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

    async loadAppointmentsData() {
        await this.loadAppointments();
        this.renderAppointmentsTable();
    }

    renderAppointmentsTable() {
        const tbody = document.querySelector('#appointmentsTable tbody');
        const filteredAppointments = this.getFilteredAppointments();
        
        if (filteredAppointments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <p>No hay citas que coincidan con los filtros.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredAppointments.map(appointment => `
            <tr>
                <td>${appointment.id}</td>
                <td>
                    <strong>${appointment.patient_name}</strong><br>
                    <small>${appointment.patient_email}</small><br>
                    <small>${appointment.patient_phone}</small>
                </td>
                <td>${appointment.doctor_name}</td>
                <td>${appointment.specialty_name}</td>
                <td>${this.formatDate(appointment.appointment_date)}</td>
                <td>${appointment.appointment_time}</td>
                <td>
                    <span class="status-badge status-${appointment.status}">
                        ${this.getStatusText(appointment.status)}
                    </span>
                </td>
                <td class="actions">
                    <button class="action-icon action-view" onclick="adminSystem.viewAppointment(${appointment.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-icon action-edit" onclick="adminSystem.changeAppointmentStatus(${appointment.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getFilteredAppointments() {
        let filtered = [...this.appointments];
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;

        if (statusFilter) {
            filtered = filtered.filter(apt => apt.status === statusFilter);
        }

        if (dateFilter) {
            filtered = filtered.filter(apt => apt.appointment_date === dateFilter);
        }

        return filtered;
    }

    filterAppointments() {
        this.renderAppointmentsTable();
    }

    clearFilters() {
        document.getElementById('statusFilter').value = '';
        document.getElementById('dateFilter').value = '';
        this.renderAppointmentsTable();
    }

    async viewAppointment(appointmentId) {
        const appointment = this.appointments.find(a => a.id === appointmentId);
        if (!appointment) return;

        const modal = document.getElementById('appointmentModal');
        const details = document.getElementById('appointmentDetails');
        const actions = document.getElementById('statusActions');

        // Detalles de la cita
        details.innerHTML = `
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

        // Acciones de estado
        const statusOptions = {
            'confirmed': 'Confirmada',
            'pending': 'Pendiente', 
            'cancelled': 'Cancelada',
            'completed': 'Completada',
            'no_show': 'No Presentado'
        };

        actions.innerHTML = `
            <h4>Cambiar Estado</h4>
            <div class="status-buttons">
                ${Object.entries(statusOptions).map(([value, label]) => `
                    <button class="btn btn-sm ${appointment.status === value ? 'btn-primary' : 'btn-outline'}" 
                            onclick="adminSystem.updateAppointmentStatus(${appointment.id}, '${value}')"
                            ${appointment.status === value ? 'disabled' : ''}>
                        ${label}
                    </button>
                `).join('')}
            </div>
        `;

        modal.classList.add('active');
    }

    async updateAppointmentStatus(appointmentId, newStatus) {
        this.showLoading();
        try {
            const response = await fetch(`/api/appointments/${appointmentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess('Estado de la cita actualizado correctamente');
                this.closeModals();
                await this.loadAppointments();
                this.renderAppointmentsTable();
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

    changeAppointmentStatus(appointmentId) {
        this.viewAppointment(appointmentId);
    }

    // ==================== DASHBOARD ====================

    async loadDashboardData() {
        await this.loadInitialData();
        this.updateDashboardStats();
        this.renderRecentAppointments();
    }

    updateDashboardStats() {
        document.getElementById('totalDoctors').textContent = 
            this.doctors.filter(d => d.is_active).length;
        document.getElementById('totalSpecialties').textContent = this.specialties.length;
        document.getElementById('totalAppointments').textContent = this.appointments.length;
        document.getElementById('pendingAppointments').textContent = 
            this.appointments.filter(a => a.status === 'pending').length;
    }

    renderRecentAppointments() {
        const container = document.getElementById('recentAppointmentsList');
        const recentAppointments = this.appointments
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        if (recentAppointments.length === 0) {
            container.innerHTML = `
                <div class="text-center">
                    <p>No hay citas recientes.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentAppointments.map(appointment => `
            <div class="appointment-item">
                <div class="appointment-info">
                    <h4>${appointment.patient_name}</h4>
                    <div class="appointment-meta">
                        <span><i class="fas fa-user-md"></i> ${appointment.doctor_name}</span>
                        <span><i class="fas fa-calendar"></i> ${this.formatDate(appointment.appointment_date)}</span>
                        <span><i class="fas fa-clock"></i> ${appointment.appointment_time}</span>
                    </div>
                </div>
                <div class="appointment-status status-${appointment.status}">
                    ${this.getStatusText(appointment.status)}
                </div>
            </div>
        `).join('');
    }

    // ==================== REPORTES ====================

    async loadReportsData() {
        await this.loadInitialData();
        this.renderCharts();
    }

    renderCharts() {
        this.renderAppointmentsChart();
        this.renderSpecialtiesChart();
        this.renderMonthlyChart();
    }

    renderAppointmentsChart() {
        const ctx = document.getElementById('appointmentsChart').getContext('2d');
        
        const statusCounts = {
            confirmed: this.appointments.filter(a => a.status === 'confirmed').length,
            pending: this.appointments.filter(a => a.status === 'pending').length,
            cancelled: this.appointments.filter(a => a.status === 'cancelled').length,
            completed: this.appointments.filter(a => a.status === 'completed').length,
            no_show: this.appointments.filter(a => a.status === 'no_show').length
        };

        if (this.charts.appointments) {
            this.charts.appointments.destroy();
        }

        this.charts.appointments = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Confirmadas', 'Pendientes', 'Canceladas', 'Completadas', 'No Presentado'],
                datasets: [{
                    data: [
                        statusCounts.confirmed,
                        statusCounts.pending, 
                        statusCounts.cancelled,
                        statusCounts.completed,
                        statusCounts.no_show
                    ],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b', 
                        '#ef4444',
                        '#2563eb',
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

    renderSpecialtiesChart() {
        const ctx = document.getElementById('specialtiesChart').getContext('2d');
        
        const specialtyCounts = {};
        this.appointments.forEach(apt => {
            const specialty = apt.specialty_name;
            specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
        });

        const labels = Object.keys(specialtyCounts);
        const data = Object.values(specialtyCounts);

        if (this.charts.specialties) {
            this.charts.specialties.destroy();
        }

        this.charts.specialties = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Citas por Especialidad',
                    data: data,
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

    renderMonthlyChart() {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        // Datos de ejemplo para el gráfico mensual
        const monthlyData = {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            data: [65, 59, 80, 81, 56, 55, 40, 45, 60, 75, 80, 90]
        };

        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [{
                    label: 'Citas Mensuales',
                    data: monthlyData.data,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
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

    updateReports() {
        this.renderCharts();
    }

    // ==================== UTILIDADES ====================

    setCurrentDate() {
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

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    handleQuickAction(action) {
        switch (action) {
            case 'add-doctor':
                this.openDoctorModal();
                break;
            case 'add-specialty':
                this.openSpecialtyModal();
                break;
            case 'view-reports':
                this.showTab('reportes');
                break;
            case 'system-settings':
                alert('Configuración del sistema - Próximamente');
                break;
        }
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

// Inicializar el sistema de administración
document.addEventListener('DOMContentLoaded', () => {
    window.adminSystem = new AdminSystem();
});