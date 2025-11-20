import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos SQLite.');
    }
});

// Función para inicializar la base de datos
export function initDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Inicializando base de datos...');
        
        db.serialize(() => {
            
            // ==================== TABLA DE ESPECIALIDADES ====================
            db.run(`CREATE TABLE IF NOT EXISTS specialties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                icon TEXT DEFAULT 'fa-stethoscope',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creando tabla specialties:', err);
                    reject(err);
                } else {
                    console.log('✅ Tabla specialties lista');
                }
            });

            // ==================== TABLA DE DOCTORES ====================
            db.run(`CREATE TABLE IF NOT EXISTS doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                specialty_id INTEGER,
                email TEXT UNIQUE,
                phone TEXT,
                photo_url TEXT DEFAULT '/assets/images/doctor-default.jpg',
                experience_years INTEGER DEFAULT 5,
                consultation_duration INTEGER DEFAULT 30,
                working_hours_start TEXT DEFAULT '09:00',
                working_hours_end TEXT DEFAULT '18:00',
                available_days TEXT DEFAULT '1,2,3,4,5',
                fee REAL DEFAULT 50.00,
                bio TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(specialty_id) REFERENCES specialties(id)
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creando tabla doctors:', err);
                    reject(err);
                } else {
                    console.log('✅ Tabla doctors lista');
                }
            });

            // ==================== TABLA DE CITAS ====================
            db.run(`CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                patient_name TEXT NOT NULL,
                patient_email TEXT NOT NULL,
                patient_phone TEXT NOT NULL,
                appointment_date DATE NOT NULL,
                appointment_time TIME NOT NULL,
                duration INTEGER DEFAULT 30,
                status TEXT DEFAULT 'confirmed',
                reason TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(doctor_id) REFERENCES doctors(id)
            )`, (err) => {
                if (err) {
                    console.error('❌ Error creando tabla appointments:', err);
                    reject(err);
                } else {
                    console.log('✅ Tabla appointments lista');
                    
                    // Esperar un momento para asegurar que las tablas se crearon
                    setTimeout(() => {
                        insertSampleData()
                            .then(() => {
                                console.log('🎉 Base de datos inicializada correctamente!');
                                resolve();
                            })
                            .catch(reject);
                    }, 500);
                }
            });
        });
    });
}

// Función para insertar datos de ejemplo
function insertSampleData() {
    return new Promise((resolve, reject) => {
        console.log('📝 Insertando datos de ejemplo...');
        
        // Especialidades médicas
        const specialties = [
            { name: 'Medicina General', description: 'Atención primaria y chequeos generales', icon: 'fa-user-md' },
            { name: 'Cardiología', description: 'Especialista en enfermedades del corazón', icon: 'fa-heartbeat' },
            { name: 'Dermatología', description: 'Cuidado de la piel y enfermedades cutáneas', icon: 'fa-allergies' },
            { name: 'Pediatría', description: 'Atención médica para niños y adolescentes', icon: 'fa-baby' },
            { name: 'Ginecología', description: 'Salud femenina y cuidado reproductivo', icon: 'fa-female' }
        ];

        let specialtiesInserted = 0;
        let doctorsInserted = 0;

        // Insertar especialidades
        specialties.forEach(spec => {
            db.run(`INSERT OR IGNORE INTO specialties (name, description, icon) VALUES (?, ?, ?)`,
                [spec.name, spec.description, spec.icon], function(err) {
                    if (err) {
                        console.error('❌ Error insertando especialidad:', err);
                    } else {
                        specialtiesInserted++;
                        console.log(`✅ Especialidad: ${spec.name}`);
                    }
                    
                    // Cuando todas las especialidades estén insertadas, insertar doctores
                    if (specialtiesInserted === specialties.length) {
                        insertDoctors().then(resolve).catch(reject);
                    }
                });
        });

        // Función para insertar doctores
        function insertDoctors() {
            return new Promise((resolve, reject) => {
                const doctors = [
                    {
                        name: 'Dr. Carlos Rodríguez', 
                        specialty_id: 1, 
                        email: 'carlos.rodriguez@clinica.com', 
                        phone: '+1 234-567-8901',
                        experience_years: 15,
                        consultation_duration: 30,
                        working_hours_start: '08:00',
                        working_hours_end: '17:00',
                        fee: 60.00,
                        bio: 'Especialista en medicina general con más de 15 años de experiencia.'
                    },
                    {
                        name: 'Dra. María González', 
                        specialty_id: 2, 
                        email: 'maria.gonzalez@clinica.com', 
                        phone: '+1 234-567-8902',
                        experience_years: 12,
                        consultation_duration: 45,
                        working_hours_start: '09:00',
                        working_hours_end: '18:00',
                        fee: 120.00,
                        bio: 'Cardióloga certificada con especialización en cardiología intervencionista.'
                    },
                    {
                        name: 'Dr. Roberto Silva', 
                        specialty_id: 3, 
                        email: 'roberto.silva@clinica.com', 
                        phone: '+1 234-567-8903',
                        experience_years: 8,
                        consultation_duration: 20,
                        working_hours_start: '10:00',
                        working_hours_end: '19:00',
                        fee: 80.00,
                        bio: 'Dermatólogo especializado en enfermedades de la piel y estética dermatológica.'
                    }
                ];

                doctors.forEach(doctor => {
                    db.run(`INSERT OR IGNORE INTO doctors 
                            (name, specialty_id, email, phone, experience_years, consultation_duration, working_hours_start, working_hours_end, fee, bio) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [doctor.name, doctor.specialty_id, doctor.email, doctor.phone, doctor.experience_years, 
                         doctor.consultation_duration, doctor.working_hours_start, doctor.working_hours_end, 
                         doctor.fee, doctor.bio], function(err) {
                            if (err) {
                                console.error('❌ Error insertando doctor:', err);
                            } else {
                                doctorsInserted++;
                                console.log(`✅ Doctor: ${doctor.name}`);
                            }
                            
                            // Cuando todos los doctores estén insertados, verificar tablas
                            if (doctorsInserted === doctors.length) {
                                verifyTables().then(resolve).catch(reject);
                            }
                        });
                });
            });
        }

        // Función para verificar las tablas
        function verifyTables() {
            return new Promise((resolve, reject) => {
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                    if (err) {
                        console.error('❌ Error verificando tablas:', err);
                        reject(err);
                    } else {
                        if (tables && tables.length > 0) {
                            const tableNames = tables.map(t => t.name);
                            console.log('📋 Tablas en la base de datos:', tableNames.join(', '));
                            console.log('👨‍⚕️ Doctores de ejemplo insertados: 3');
                            console.log('🏥 Especialidades insertadas: 5');
                            resolve();
                        } else {
                            console.log('⚠️ No se encontraron tablas en la base de datos');
                            resolve();
                        }
                    }
                });
            });
        }
    });
}

// Exportar la instancia de la base de datos
export function getDB() {
    return db;
}

// Cerrar conexión gracefulmente
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error cerrando base de datos:', err.message);
        } else {
            console.log('🔒 Conexión a la base de datos cerrada.');
        }
        process.exit(0);
    });
});

// Función para ejecutar la inicialización manualmente
export function runInit() {
    return initDatabase()
        .then(() => {
            console.log('🎉 Script de inicialización completado exitosamente!');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Error en inicialización:', err);
            process.exit(1);
        });
}

// Si se ejecuta este archivo directamente, inicializar la base de datos
if (import.meta.url.includes(process.argv[1])) {
    runInit();
} else if (process.argv[1] && process.argv[1].includes('database.js')) {
    runInit();
}