# 🌱 AgroTechNova

**Sistema Integrado de Gestión para el Centro de Agroindustria**  
*Parque Tecnológico Universitario - Universidad Pontificia Bolivariana*

---

## 📋 Tabla de Contenidos

- [Descripción del Proyecto](#-descripción-del-proyecto)
- [Características Principales](#-características-principales)
- [Arquitectura del Sistema](#️-arquitectura-del-sistema)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Documentación API](#-documentación-api)
- [Base de Datos](#️-base-de-datos)
- [Usuarios de Prueba](#-usuarios-de-prueba)
- [Scripts Disponibles](#-scripts-disponibles)
- [Desarrollo](#-desarrollo)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

---

## 📖 Descripción del Proyecto

**AgroTechNova** es una plataforma digital integral diseñada para gestionar proyectos agroindustriales de forma eficiente y organizada. El sistema permite a productores, asesores y administradores colaborar en tiempo real, proporcionando herramientas tecnológicas para la planificación, ejecución y seguimiento de proyectos del sector agroindustrial.

### 🎯 Objetivos

- **Gestionar y monitorear** proyectos agroindustriales de forma centralizada
- **Proporcionar asesoría técnica** especializada y consultorías personalizadas  
- **Facilitar la toma de decisiones** mediante herramientas digitales y datos precisos
- **Promover la sostenibilidad** en todas las fases de producción
- **Optimizar recursos** y mejorar la trazabilidad de procesos

### 🏢 Identidad Corporativa

- **Empresa:** AgroTechNova - Centro de Agroindustria Inteligente
- **Lema:** *"Innovación que cuida, bienestar que produce"*
- **Enfoque:** Tecnología para potenciar la productividad agroindustrial
- **Institución:** Universidad Pontificia Bolivariana (UPB)

---

## ✨ Características Principales

### 📊 **Gestión de Proyectos**
- Planificación por fases con fechas y presupuestos
- Seguimiento en tiempo real del avance
- Asignación de recursos materiales, humanos y financieros
- Generación de reportes de progreso

### 👥 **Gestión de Usuarios**
- Sistema de roles (Productor, Asesor, Administrador)
- Autenticación segura con JWT
- Perfiles personalizables
- Historial de actividades

### 🌱 **Módulo Agroindustrial**
- Registro de insumos orgánicos y químicos
- Control de inventario especializado
- Gestión de maquinaria y herramientas
- Seguimiento de normativas (BPA, orgánico, etc.)

### 🤝 **Asesorías y Colaboraciones**
- Solicitud de asesorías técnicas
- Asignación automática de asesores
- Integración con entidades colaboradoras
- Reuniones virtuales programadas

### 📈 **Reportes y Analytics**
- Informes financieros detallados
- Comparativas presupuesto vs gastos reales
- Reportes de utilización de recursos
- Exportación en PDF y Excel

### 📱 **Portal Web**
- Catálogo de servicios del centro
- Visualización de proyectos finalizados
- Información institucional (misión, visión, aliados)
- Búsqueda avanzada de proyectos

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│     FRONTEND        │    │      BACKEND        │    │     BASE DE DATOS   │
│                     │    │                     │    │                     │
│  • HTML5/CSS3/JS    │◄──►│  • Node.js          │◄──►│  • MySQL 8.0        │
│  • Responsive       │    │  • Express.js       │    │  • 27 Tablas        │
│  • Identidad UPB    │    │  • JWT Auth         │    │  • Triggers/Views   │
│                     │    │  • API RESTful      │    │  • Índices          │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     │
              ┌─────────────────────────────────────┐
              │          SERVICIOS EXTERNOS         │
              │                                     │
              │  • Email (Nodemailer)               │
              │  • Notificaciones SMS               │
              │  • APIs de terceros                 │
              │  • Reuniones virtuales              │
              └─────────────────────────────────────┘
```

### 🔧 **Componentes Principales**

#### **Frontend (Cliente)**
- **Tecnología:** HTML5, CSS3, JavaScript Vanilla
- **Diseño:** Responsive con identidad corporativa AgroTechNova + UPB
- **Funcionalidades:** Interfaz de usuario, validaciones, interactividad

#### **Backend (Servidor)**
- **Tecnología:** Node.js con Express.js
- **Autenticación:** JWT (JSON Web Tokens)
- **Middleware:** Helmet, CORS, Rate Limiting
- **API:** RESTful con validación de datos

#### **Base de Datos**
- **Motor:** MySQL 8.0
- **Estructura:** 27 tablas relacionales
- **Características:** Triggers, vistas, índices optimizados
- **Backup:** Sistema automático de respaldos

---

## 🛠 Tecnologías Utilizadas

### **Backend**
```json
{
  "runtime": "Node.js 16+",
  "framework": "Express.js 4.18+",
  "database": "MySQL2 3.6+",
  "authentication": "jsonwebtoken 9.0+",
  "security": ["bcryptjs", "helmet", "cors"],
  "validation": "express-validator 7.0+",
  "email": "nodemailer 6.9+",
  "reports": ["pdfkit", "exceljs"],
  "uploads": "multer 1.4+"
}
```

### **Frontend**
```json
{
  "markup": "HTML5",
  "styling": "CSS3 (Grid/Flexbox)",
  "scripting": "JavaScript ES6+",
  "responsive": "Mobile-first design",
  "icons": "Font Awesome",
  "charts": "Chart.js (futuro)"
}
```

### **Base de Datos**
```sql
{
  "engine": "MySQL 8.0+",
  "charset": "utf8mb4_unicode_ci",
  "features": ["Foreign Keys", "Triggers", "Views", "Indexes"],
  "backup": "Automated daily backups"
}
```

---

## 🚀 Instalación y Configuración

### **Prerrequisitos**

- **Node.js** 16.0 o superior
- **MySQL** 8.0 o superior
- **Git** (opcional)

### **1. Clonar/Descargar el Proyecto**

```bash
# Si usas Git
git clone <repository-url>
cd AgroSpinoff

# O descargar y extraer el ZIP
```

### **2. Instalar Dependencias**

```bash
# Instalar todas las dependencias de Node.js
npm install
```

### **3. Configurar Variables de Entorno**

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar el archivo .env con tus configuraciones
```

**Configuración del archivo `.env`:**
```env
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración de base de datos MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=agrotech_nova
DB_USER=root
DB_PASSWORD=tu_password_mysql

# Configuración JWT
JWT_SECRET=tu_clave_secreta_super_segura
JWT_EXPIRES_IN=24h

# Configuración de correo (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_password_email
```

### **4. Configurar Base de Datos**

#### **4.1 Crear Base de Datos**
```sql
-- Conectar a MySQL y ejecutar:
CREATE DATABASE agrotech_nova CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### **4.2 Ejecutar Scripts de Configuración**
```bash
# Crear todas las tablas y datos iniciales
node setup-db.js

# O manualmente:
mysql -u root -p agrotech_nova < database/schema.sql
mysql -u root -p agrotech_nova < database/seeds.sql
```

### **5. Verificar Instalación**

```bash
# Verificar que todo esté configurado correctamente
node check-env.js
```

### **6. Iniciar el Servidor**

```bash
# Modo producción
npm start

# Modo desarrollo (con nodemon)
npm run dev
```

El servidor estará disponible en:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:3000/api

---

## 📁 Estructura del Proyecto

```
AgroSpinoff/
├── 📁 frontend/                    # Cliente (Frontend)
│   └── 📁 public/
│       ├── 📄 index.html           # Página principal
│       ├── 📄 login.html           # Autenticación
│       ├── 📄 dashboard.html       # Panel de control
│       ├── 📄 proyectos.html       # Gestión de proyectos
│       └── 📁 assets/
│           ├── 📁 css/             # Estilos CSS
│           ├── 📁 js/              # Scripts JavaScript
│           └── 📁 img/             # Imágenes
├── 📁 backend/                     # Servidor (Backend)
│   ├── 📄 server.js                # Servidor principal
│   ├── 📁 routes/                  # Rutas de API
│   │   ├── 📄 auth.js              # Autenticación
│   │   ├── 📄 users.js             # Usuarios
│   │   ├── 📄 projects.js          # Proyectos
│   │   └── 📄 reports.js           # Reportes
│   ├── 📁 models/                  # Modelos de datos
│   ├── 📁 middleware/              # Middleware personalizado
│   │   └── 📄 auth.js              # Autenticación JWT
│   └── 📁 config/                  # Configuraciones
│       └── 📄 database.js          # Conexión MySQL
├── 📁 database/                    # Base de datos
│   ├── 📄 schema.sql               # Esquema de tablas
│   ├── 📄 seeds.sql                # Datos iniciales
│   └── 📁 migrations/              # Migraciones futuras
├── 📁 uploads/                     # Archivos subidos
├── 📄 package.json                 # Dependencias Node.js
├── 📄 .env.example                 # Variables de entorno
├── 📄 .gitignore                   # Archivos ignorados
├── 📄 setup-db.js                  # Script configuración DB
├── 📄 check-env.js                 # Verificación entorno
└── 📄 README.md                    # Este archivo
```

---

## 📡 Documentación API

### **Autenticación**

#### `POST /api/auth/login`
Iniciar sesión en el sistema
```json
{
  "email": "usuario@agrotechnova.com",
  "password": "contraseña"
}
```

#### `POST /api/auth/register`
Registrar nuevo usuario
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan.perez@agrotechnova.com",
  "password": "contraseña123",
  "rol": "productor"
}
```

### **Usuarios**

#### `GET /api/users/profile`
Obtener perfil del usuario actual (requiere autenticación)

#### `PUT /api/users/profile`
Actualizar perfil del usuario
```json
{
  "nombre": "Juan Carlos",
  "telefono": "3001234567"
}
```

### **Proyectos**

#### `GET /api/projects`
Listar proyectos (con filtros opcionales)
- Parámetros: `page`, `limit`, `categoria`, `estado`, `search`

#### `POST /api/projects`
Crear nuevo proyecto
```json
{
  "nombre": "Cultivo de Maíz Orgánico",
  "descripcion": "Proyecto de cultivo sostenible",
  "categoria": "agricola",
  "fecha_inicio": "2025-03-01",
  "fecha_fin": "2025-12-15",
  "presupuesto_total": 15000000.00
}
```

#### `GET /api/projects/:id`
Obtener detalles de un proyecto específico

#### `PUT /api/projects/:id`
Actualizar proyecto existente

### **Reportes**

#### `GET /api/reports/project/:id`
Generar reporte de avance de proyecto

#### `GET /api/reports/financial`
Reporte financiero general (solo administradores)

#### `GET /api/reports/resources/:projectId`
Reporte de utilización de recursos

---

## 🗄️ Base de Datos

### **Tablas Principales**

| Tabla | Descripción | Registros |
|-------|-------------|-----------|
| `usuarios` | Gestión de usuarios del sistema | 7 |
| `proyectos` | Proyectos agroindustriales | 3 |
| `fases_proyecto` | Fases de cada proyecto | 10 |
| `insumos_proyecto` | Insumos utilizados | - |
| `gastos_proyecto` | Gastos registrados | - |
| `asesorias_tecnicas` | Solicitudes de asesoría | 4 |
| `proveedores` | Proveedores de insumos | 4 |
| `entidades_colaboradoras` | Entidades aliadas | 5 |
| `notificaciones` | Sistema de notificaciones | 3 |

### **Vistas Creadas**

- `vista_resumen_proyectos`: Resumen financiero de proyectos
- `vista_asesorias_pendientes`: Asesorías por atender

### **Características Técnicas**

- **27 tablas** relacionales con integridad referencial
- **Índices optimizados** para consultas frecuentes
- **Triggers** para actualización automática
- **Campos calculados** para totales financieros
- **Soporte JSON** para datos adicionales

---

## 👥 Usuarios de Prueba

### **Administrador**
- **Email:** admin@agrotechnova.com
- **Password:** admin123
- **Rol:** Administrador

### **Productores**
- **Email:** juan.rodriguez@agrotechnova.com
- **Email:** maria.garcia@agrotechnova.com
- **Email:** carlos.mendoza@agrotechnova.com
- **Password:** usuario123
- **Rol:** Productor

### **Asesores**
- **Email:** patricia.vasquez@agrotechnova.com
- **Email:** roberto.silva@agrotechnova.com
- **Password:** asesor123
- **Rol:** Asesor

> **Nota:** Todas las contraseñas están hasheadas con bcrypt. Las contraseñas originales son las mostradas arriba.

---

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar con nodemon (auto-reload)

# Producción
npm start            # Iniciar servidor

# Base de datos
npm run install-db   # Crear esquema (requiere MySQL CLI)
npm run seed-db      # Insertar datos iniciales

# Utilidades
node setup-db.js     # Configurar BD completa
node check-env.js    # Verificar configuración
node test-mysql.js   # Probar conexión MySQL
```

---

## 💻 Desarrollo

### **Agregar Nuevas Funcionalidades**

1. **Backend:** Crear rutas en `/backend/routes/`
2. **Frontend:** Añadir páginas en `/frontend/public/`
3. **Base de Datos:** Crear migraciones en `/database/migrations/`

### **Estructura de Rutas API**

```javascript
// Ejemplo de nueva ruta
router.get('/nuevo-endpoint', authenticateToken, async (req, res) => {
    try {
        // Lógica del endpoint
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
```

### **Middleware Disponible**

- `authenticateToken`: Verificar JWT
- `requireRole(['admin'])`: Verificar rol específico
- `requireActiveUser`: Verificar usuario activo

### **Convenciones de Código**

- **Nombres:** camelCase para JavaScript, snake_case para SQL
- **Respuestas API:** Siempre incluir `success` y `message`
- **Errores:** Usar códigos HTTP apropiados
- **Validación:** Usar express-validator en todas las rutas

---

## 🔒 Seguridad

- **Autenticación:** JWT con expiración
- **Contraseñas:** Hasheadas con bcrypt (12 rounds)
- **Validación:** Validación de entrada en todas las rutas
- **CORS:** Configurado para dominios específicos
- **Rate Limiting:** Protección contra ataques DDoS
- **Helmet:** Headers de seguridad HTTP

---

### **Problemas Conocidos**

1. **Triggers MySQL:** Algunos triggers requieren configuración manual
2. **Variables .env:** Verificar que se carguen correctamente
3. **CORS:** Configurar dominio en producción

---

## 🎉 Changelog

### **v1**
- ✅ Sistema completo de autenticación
- ✅ Gestión de proyectos agroindustriales
- ✅ Base de datos con 27 tablas
- ✅ API RESTful completa
- ✅ Sistema de reportes
- ✅ Interfaz web básica

---

**Para el sector agroindustrial**

