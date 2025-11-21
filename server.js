import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, getDB } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// Inicializar base de datos
initDatabase().then(() => {
    console.log('📊 Base de datos lista');
}).catch(err => {
    console.error('❌ Error inicializando base de datos:', err);
});

const db = getDB();

// ==================== RUTAS PÚBLICAS (Para usuarios) ====================

// Obtener especialidades activas
app.get('/api/specialties', (req, res) => {
    const query = `SELECT * FROM specialties ORDER BY name`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error obteniendo especialidades:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// Obtener doctores por especialidad
app.get('/api/doctors', (req, res) => {
    const { specialty_id } = req.query;
    let query = `
        SELECT d.*, s.name as specialty_name, s.icon as specialty_icon 
        FROM doctors d 
        LEFT JOIN specialties s ON d.specialty_id = s.id 
        WHERE d.is_active = 1
    `;
    let params = [];

    if (specialty_id) {
        query += ' AND d.specialty_id = ?';
        params.push(specialty_id);
    }

    query += ' ORDER BY d.name';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error obteniendo doctores:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// 🔍 Obtener horarios disponibles de un doctor
app.get('/api/doctors/:id/availability', (req, res) => {
    const doctorId = req.params.id;
    const { date } = req.query;

    console.log(`🔍 Solicitando disponibilidad para doctor ${doctorId}, fecha: ${date}`);

    if (!date) {
        return res.status(400).json({
            success: false,
            error: 'La fecha es requerida'
        });
    }

    // Primero obtener información del doctor
    db.get(`SELECT * FROM doctors WHERE id = ? AND is_active = 1`, [doctorId], (err, doctor) => {
        if (err) {
            console.error('❌ Error obteniendo doctor:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor - Consulta doctor' 
            });
        }

        if (!doctor) {
            console.log(`❌ Doctor ${doctorId} no encontrado o inactivo`);
            return res.status(404).json({
                success: false,
                error: 'Doctor no encontrado'
            });
        }

        console.log(`✅ Doctor encontrado: ${doctor.name}, Horario: ${doctor.working_hours_start} - ${doctor.working_hours_end}`);

        // Obtener citas existentes para esa fecha
        const query = `SELECT appointment_time FROM appointments 
                      WHERE doctor_id = ? AND appointment_date = ? AND status IN ('confirmed', 'pending')`;
        
        console.log(`📅 Buscando citas existentes: doctor_id=${doctorId}, date=${date}`);
        
        db.all(query, [doctorId, date], (err, appointments) => {
            if (err) {
                console.error('❌ Error obteniendo citas:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error interno del servidor - Consulta citas' 
                });
            }

            console.log(`📊 Citas encontradas: ${appointments.length}`);

            const bookedSlots = appointments.map(apt => apt.appointment_time);
            console.log(`⏰ Horarios reservados:`, bookedSlots);

            try {
                const availableSlots = generateTimeSlots(doctor, bookedSlots);
                console.log(`✅ Horarios disponibles generados: ${availableSlots.length}`);

                res.json({
                    success: true,
                    data: {
                        doctor: {
                            id: doctor.id,
                            name: doctor.name,
                            specialty_id: doctor.specialty_id,
                            working_hours_start: doctor.working_hours_start,
                            working_hours_end: doctor.working_hours_end,
                            consultation_duration: doctor.consultation_duration
                        },
                        available_slots: availableSlots,
                        booked_slots: bookedSlots
                    }
                });
            } catch (error) {
                console.error('❌ Error generando horarios:', error);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error generando horarios disponibles' 
                });
            }
        });
    });
});

// Crear nueva cita
app.post('/api/appointments', (req, res) => {
    const {
        doctor_id,
        patient_name,
        patient_email,
        patient_phone,
        appointment_date,
        appointment_time,
        reason,
        notes
    } = req.body;

    // Validaciones
    if (!doctor_id || !patient_name || !patient_email || !patient_phone || !appointment_date || !appointment_time) {
        return res.status(400).json({
            success: false,
            error: 'Todos los campos obligatorios deben ser completados'
        });
    }

    // Verificar disponibilidad
    const checkQuery = `SELECT id FROM appointments 
                       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? 
                       AND status IN ('confirmed', 'pending')`;

    db.get(checkQuery, [doctor_id, appointment_date, appointment_time], (err, existing) => {
        if (err) {
            console.error('Error verificando disponibilidad:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Lo sentimos, ese horario ya está reservado. Por favor elige otro horario.'
            });
        }

        // Insertar cita
        const insertQuery = `INSERT INTO appointments 
                            (doctor_id, patient_name, patient_email, patient_phone, 
                             appointment_date, appointment_time, reason, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(insertQuery, [
            doctor_id, patient_name, patient_email, patient_phone,
            appointment_date, appointment_time, reason, notes
        ], function(err) {
            if (err) {
                console.error('Error creando cita:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error interno del servidor' 
                });
            }

            // Obtener información completa de la cita
            db.get(`SELECT a.*, d.name as doctor_name, s.name as specialty_name 
                    FROM appointments a 
                    JOIN doctors d ON a.doctor_id = d.id 
                    JOIN specialties s ON d.specialty_id = s.id 
                    WHERE a.id = ?`, [this.lastID], (err, appointment) => {
                if (err) {
                    console.error('Error obteniendo cita:', err);
                }

                res.status(201).json({
                    success: true,
                    message: '¡Cita reservada exitosamente!',
                    data: {
                        appointment_id: this.lastID,
                        appointment: appointment
                    }
                });
            });
        });
    });
});

// Buscar citas por paciente (email o teléfono)
app.get('/api/patient/appointments', (req, res) => {
    const { email, phone } = req.query;

    if (!email && !phone) {
        return res.status(400).json({
            success: false,
            error: 'Se requiere email o teléfono para buscar citas'
        });
    }

    let query = `
        SELECT a.*, d.name as doctor_name, s.name as specialty_name, s.icon as specialty_icon
        FROM appointments a 
        JOIN doctors d ON a.doctor_id = d.id 
        JOIN specialties s ON d.specialty_id = s.id 
        WHERE (a.patient_email = ? OR a.patient_phone = ?)
    `;
    let params = [email || '', phone || ''];

    // Si ambos parámetros están presentes, buscar por ambos
    if (email && phone) {
        query = `
            SELECT a.*, d.name as doctor_name, s.name as specialty_name, s.icon as specialty_icon
            FROM appointments a 
            JOIN doctors d ON a.doctor_id = d.id 
            JOIN specialties s ON d.specialty_id = s.id 
            WHERE (a.patient_email = ? AND a.patient_phone = ?)
        `;
        params = [email, phone];
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error buscando citas:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// ==================== RUTAS DE ADMINISTRACIÓN ====================

// 🔧 GESTIÓN DE ESPECIALIDADES

// Obtener todas las especialidades (admin)
app.get('/api/admin/specialties', (req, res) => {
    const query = `SELECT * FROM specialties ORDER BY name`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error obteniendo especialidades:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// Crear nueva especialidad
app.post('/api/admin/specialties', (req, res) => {
    const { name, description, icon } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            error: 'El nombre de la especialidad es requerido'
        });
    }

    db.run(`INSERT INTO specialties (name, description, icon) VALUES (?, ?, ?)`,
        [name, description, icon || 'fa-stethoscope'], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                    return res.status(409).json({
                        success: false,
                        error: 'Ya existe una especialidad con ese nombre'
                    });
                }
                console.error('Error creando especialidad:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error interno del servidor' 
                });
            }

            res.status(201).json({
                success: true,
                message: 'Especialidad creada exitosamente',
                data: { id: this.lastID }
            });
        });
});

// 🔧 GESTIÓN DE DOCTORES

// Obtener todos los doctores (admin)
app.get('/api/admin/doctors', (req, res) => {
    const query = `
        SELECT d.*, s.name as specialty_name, s.icon as specialty_icon 
        FROM doctors d 
        LEFT JOIN specialties s ON d.specialty_id = s.id 
        ORDER BY d.name
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error obteniendo doctores:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// Crear nuevo doctor
app.post('/api/admin/doctors', (req, res) => {
    const {
        name,
        specialty_id,
        email,
        phone,
        experience_years,
        consultation_duration,
        working_hours_start,
        working_hours_end,
        available_days,
        fee,
        bio
    } = req.body;

    if (!name || !specialty_id || !email) {
        return res.status(400).json({
            success: false,
            error: 'Nombre, especialidad y email son requeridos'
        });
    }

    const query = `
        INSERT INTO doctors 
        (name, specialty_id, email, phone, experience_years, consultation_duration, 
         working_hours_start, working_hours_end, available_days, fee, bio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
        name, specialty_id, email, phone, experience_years || 5,
        consultation_duration || 30, working_hours_start || '09:00',
        working_hours_end || '18:00', available_days || '1,2,3,4,5',
        fee || 50.00, bio
    ], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(409).json({
                    success: false,
                    error: 'Ya existe un doctor con ese email'
                });
            }
            console.error('Error creando doctor:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }

        res.status(201).json({
            success: true,
            message: 'Doctor creado exitosamente',
            data: { id: this.lastID }
        });
    });
});

// Actualizar doctor
app.put('/api/admin/doctors/:id', (req, res) => {
    const doctorId = req.params.id;
    const {
        name,
        specialty_id,
        email,
        phone,
        experience_years,
        consultation_duration,
        working_hours_start,
        working_hours_end,
        available_days,
        fee,
        bio,
        is_active
    } = req.body;

    const query = `
        UPDATE doctors SET 
        name = ?, specialty_id = ?, email = ?, phone = ?, experience_years = ?,
        consultation_duration = ?, working_hours_start = ?, working_hours_end = ?,
        available_days = ?, fee = ?, bio = ?, is_active = ?
        WHERE id = ?
    `;

    db.run(query, [
        name, specialty_id, email, phone, experience_years,
        consultation_duration, working_hours_start, working_hours_end,
        available_days, fee, bio, is_active, doctorId
    ], function(err) {
        if (err) {
            console.error('Error actualizando doctor:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Doctor no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Doctor actualizado exitosamente'
        });
    });
});

// 🔧 GESTIÓN DE CITAS (Admin)

// Obtener todas las citas
app.get('/api/admin/appointments', (req, res) => {
    const { status, date, doctor_id } = req.query;
    
    let query = `
        SELECT a.*, d.name as doctor_name, s.name as specialty_name, s.icon as specialty_icon
        FROM appointments a 
        JOIN doctors d ON a.doctor_id = d.id 
        JOIN specialties s ON d.specialty_id = s.id 
    `;
    let params = [];

    const conditions = [];
    if (status) {
        conditions.push('a.status = ?');
        params.push(status);
    }
    if (date) {
        conditions.push('a.appointment_date = ?');
        params.push(date);
    }
    if (doctor_id) {
        conditions.push('a.doctor_id = ?');
        params.push(doctor_id);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error obteniendo citas:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

// 🔄 Actualizar estado de una cita - VERSIÓN CORREGIDA
app.patch('/api/appointments/:id/status', (req, res) => {
    const appointmentId = req.params.id;
    const { status } = req.body;

    console.log(`🔄 Solicitando cambio de estado para cita ${appointmentId} a: ${status}`);

    // Validar que el estado esté presente
    if (!status) {
        console.log('❌ Estado no proporcionado');
        return res.status(400).json({
            success: false,
            error: 'El estado es requerido'
        });
    }

    // Validar que el estado sea válido
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
        console.log(`❌ Estado no válido: ${status}`);
        return res.status(400).json({
            success: false,
            error: 'Estado no válido. Los estados permitidos son: pending, confirmed, cancelled, completed, no_show'
        });
    }

    // Primero verificar que la cita existe
    db.get(`SELECT id FROM appointments WHERE id = ?`, [appointmentId], (err, appointment) => {
        if (err) {
            console.error('❌ Error verificando cita:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor al verificar la cita' 
            });
        }

        if (!appointment) {
            console.log(`❌ Cita ${appointmentId} no encontrada`);
            return res.status(404).json({
                success: false,
                error: 'Cita no encontrada'
            });
        }

        console.log(`✅ Cita ${appointmentId} encontrada, procediendo a actualizar estado...`);

        // Actualizar el estado de la cita
        const updateQuery = `UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        
        db.run(updateQuery, [status, appointmentId], function(err) {
            if (err) {
                console.error('❌ Error actualizando cita:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error interno del servidor al actualizar la cita' 
                });
            }

            console.log(`✅ Cita ${appointmentId} actualizada. Cambios: ${this.changes}`);

            if (this.changes === 0) {
                console.log(`⚠️ No se realizaron cambios en la cita ${appointmentId}`);
                return res.status(404).json({
                    success: false,
                    error: 'No se pudo actualizar la cita'
                });
            }

            // Obtener la cita actualizada para devolverla
            db.get(`SELECT a.*, d.name as doctor_name, s.name as specialty_name 
                    FROM appointments a 
                    JOIN doctors d ON a.doctor_id = d.id 
                    JOIN specialties s ON d.specialty_id = s.id 
                    WHERE a.id = ?`, [appointmentId], (err, updatedAppointment) => {
                if (err) {
                    console.error('❌ Error obteniendo cita actualizada:', err);
                    // Aún así devolvemos éxito porque la actualización fue exitosa
                }

                console.log(`🎉 Estado de cita ${appointmentId} cambiado a: ${status}`);
                
                res.json({
                    success: true,
                    message: `Cita ${getStatusText(status)} exitosamente`,
                    data: {
                        appointment: updatedAppointment
                    }
                });
            });
        });
    });
});

// ==================== RUTAS PARA DOCTORES ====================

// Obtener citas de un doctor específico
app.get('/api/doctors/:id/appointments', (req, res) => {
    const doctorId = req.params.id;
    const { status, date } = req.query;
    
    let query = `
        SELECT a.*, d.name as doctor_name, s.name as specialty_name
        FROM appointments a 
        JOIN doctors d ON a.doctor_id = d.id 
        JOIN specialties s ON d.specialty_id = s.id 
        WHERE a.doctor_id = ?
    `;
    let params = [doctorId];

    if (status) {
        query += ' AND a.status = ?';
        params.push(status);
    }
    if (date) {
        query += ' AND a.appointment_date = ?';
        params.push(date);
    }

    query += ' ORDER BY a.appointment_date, a.appointment_time';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error obteniendo citas del doctor:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error interno del servidor' 
            });
        }
        res.json({
            success: true,
            data: rows
        });
    });
});

/// ==================== FUNCIONES AUXILIARES MEJORADAS ====================

// Generar horarios disponibles con validación
function generateTimeSlots(doctor, bookedSlots) {
    try {
        const slots = [];
        
        // Validar y obtener valores por defecto
        const start = doctor.working_hours_start || '09:00';
        const end = doctor.working_hours_end || '18:00';
        const duration = parseInt(doctor.consultation_duration) || 30;

        console.log(`⏰ Generando slots: ${start} - ${end}, duración: ${duration}min`);

        // Validar formato de horas
        if (!isValidTime(start) || !isValidTime(end)) {
            throw new Error('Formato de hora inválido');
        }

        let currentTime = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);

        if (currentTime >= endMinutes) {
            console.log('⚠️ Horario inválido: hora inicio >= hora fin');
            return [];
        }

        while (currentTime + duration <= endMinutes) {
            const timeString = minutesToTime(currentTime);
            
            // Verificar si no está reservado
            if (!bookedSlots.includes(timeString)) {
                slots.push({
                    time: timeString,
                    display: formatTimeDisplay(timeString)
                });
            }
            
            currentTime += duration;
        }

        console.log(`✅ Slots generados: ${slots.length}`);
        return slots;
    } catch (error) {
        console.error('❌ Error en generateTimeSlots:', error);
        throw error;
    }
}

function timeToMinutes(time) {
    try {
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
            throw new Error(`Hora inválida: ${time}`);
        }
        return hours * 60 + minutes;
    } catch (error) {
        console.error('❌ Error en timeToMinutes:', error);
        return 540; // 9:00 AM por defecto
    }
}

function minutesToTime(minutes) {
    try {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    } catch (error) {
        console.error('❌ Error en minutesToTime:', error);
        return '09:00';
    }
}

function formatTimeDisplay(time) {
    try {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
        console.error('❌ Error en formatTimeDisplay:', error);
        return time;
    }
}

function isValidTime(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}

function getStatusText(status) {
    const statusMap = {
        'confirmed': 'confirmada',
        'cancelled': 'cancelada',
        'completed': 'completada',
        'pending': 'marcada como pendiente',
        'no_show': 'marcada como no presentado'
    };
    return statusMap[status] || status;
}

// ==================== MANEJO DE ERRORES GLOBAL ====================

// Middleware para rutas no encontradas (404)
app.use('*', (req, res) => {
    console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
    });
});

// Middleware de manejo de errores global
app.use((error, req, res, next) => {
    console.error('❌ Error global no manejado:', error);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// Asegurar que todas las respuestas sean JSON
app.use((req, res, next) => {
    // Solo establecer Content-Type para respuestas que no lo tengan
    if (!res.get('Content-Type')) {
        res.set('Content-Type', 'application/json');
    }
    next();
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📋 API disponible en http://localhost:${PORT}/api/`);
    console.log(`👨‍💼 Panel admin: http://localhost:${PORT}/admin.html`);
    console.log(`👨‍⚕️ Panel doctores: http://localhost:${PORT}/doctor.html`);
    console.log(`📅 Sistema de reservas listo para usar`);
});

process.on('SIGTERM', () => {
    console.log('🛑 Apagando servidor...');
    process.exit(0);
});