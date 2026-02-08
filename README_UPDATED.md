# Beds25 PMS - Property Management System 🏠

Una solución completa de gestión de propiedades en alquiler turístico con **facturación automática**, **analytics avanzado** e **integraciones de pagos y email**.

## ✨ Características

### 📊 Core Features (FASES 0-2)
- ✅ **Calendario de Reservas**: Visualización intuitiva de disponibilidad
- ✅ **Gestión de Huéspedes**: Con datos bancarios e historial de reservas
- ✅ **Propiedades y Habitaciones**: Configuración flexible por inmueble
- ✅ **Facturación Automática**: Series por propietario, generación atómica
- ✅ **Documentos**: Almacenamiento centralizado (DNI, contratos, fichas)

### 💰 Módulos Financieros (FASE 1)
- ✅ **Reservas**: Pendientes y abonadas con estado, método y factura

### 📈 Analytics & Reportes (FASE 3)
- ✅ **Dashboard KPI**: Ingresos, ocupación, huéspedes, pagos pendientes
- ✅ **Ocupación Diaria**: Últimos 30 días con visualización
- ✅ **Ingresos Diarios**: Análisis de revenue
- ✅ **Métricas por Propiedad**: Ocupación, ingresos, promedio
- ✅ **Métricas por Propietario**: Ingresos, comisiones, reservas
- ✅ **Exportación CSV**: Todos los reportes a Excel

### 🔗 Integraciones (FASE 4)
- ✅ **Email**: Gmail / SendGrid para notificaciones
- ✅ **Pagos**: Stripe para cobros online
- ✅ **Notificaciones**: Automáticas en eventos clave

---

## 🚀 Quick Start

### Requisitos
- Node.js 16+
- MySQL 8+
- npm o yarn

### Instalación

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd beds25

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus datos

# 4. Ejecutar migraciones
node scripts/migrate-phase2.js

# 5. Iniciar backend (en terminal 1)
node api/server.js

# 6. Iniciar frontend (en terminal 2)
npm run dev
```

### Acceso
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3003
- **Admin**: Login automático (ver db.ts)

---

## 📁 Estructura del Proyecto

```
beds25/
├── pages/                    # Páginas React
│   ├── Dashboard.tsx        # Calendario
│   ├── Guests.tsx           # Base de huéspedes
│   ├── Properties.tsx       # Inmuebles
│   ├── Owners.tsx           # Propietarios
│   ├── Reservations.tsx     # Reservas (FASE 1)
│   ├── Analytics.tsx        # Dashboard Analytics (FASE 3)
│
├── components/              # Componentes reutilizables
│   ├── Layout.tsx
│   ├── ReservationModal.tsx
│   └── DocumentUpload.tsx
│
├── services/               # Servicios y lógica
│   ├── db.ts              # Base de datos
│   ├── analytics.ts       # Cálculos y KPIs (FASE 3)
│   ├── documents.ts       # Gestión de archivos (FASE 2)
│   ├── email.ts           # Notificaciones por email (FASE 4)
│   ├── payments.ts        # Integración Stripe (FASE 4)
│   └── notifications.ts   # Sistema de notificaciones (FASE 4)
│
├── api/                   # Backend Express
│   └── server.js          # API REST
│
├── scripts/              # Scripts utilitarios
│   ├── migrate-phase2.js  # Migraciones DB
│   └── db-test.js
│
├── types.ts             # Tipos TypeScript
├── App.tsx              # Rutas
├── index.tsx            # Punto de entrada
├── vite.config.ts       # Configuración Vite
└── package.json
```

---

## 📖 Documentación

| Documento | Contenido |
|-----------|-----------|
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | Resumen general del proyecto |
| [types.ts](./types.ts) | Definición de tipos TypeScript |

---

## 🎯 Funcionalidades por Sección

### 📅 Dashboard (Home)
- Vista de calendario mensual
- Filtro por propiedad
- Visualización de reservas
- Estados de habitaciones

### 👥 Huéspedes
- CRUD completo
- Historial de reservas
- Datos bancarios (IBAN)
- Documentos (DNI, contrato)
- Notas personalizadas

### 🏠 Propiedades
- Gestión de inmuebles
- Configuración de habitaciones
- Propietarios asignados
- Dirección y contacto

### 🤵 Propietarios
- Datos personales y fiscales
- IBAN para comisiones
- Número de serie de facturas
- Series de facturación automática

### 🧾 Reservas (FASE 1)
- Listado de reservas pendientes y abonadas
- Filtros por propietario/propiedad/fecha
- Estado de pago y método (Banco/Efectivo)
- Número de factura cuando está abonada
- Edición con doble clic

### 📈 Analytics (FASE 3)
5 tabs con reportes completos:
1. **KPIs**: Ingresos, reservas, ocupación, huéspedes
2. **Ocupación**: Datos diarios últimos 30 días
3. **Ingresos**: Evolución de revenue
4. **Propiedades**: Métricas individuales
5. **Propietarios**: Comisiones y balance

Todos exportables a CSV.

## 🔐 Seguridad

- ✅ Validación de overbooking (conflictos de fechas)
- ✅ Bloqueo de eliminación de reservas facturadas
- ✅ Transacciones atómicas en facturación
- ✅ Autenticación básica (expandible)
- ✅ Validación de entrada en formularios

---

## 🧪 Testing

### Test Pagos (Stripe)
```
Tarjeta: 4242 4242 4242 4242
Mes/Año: 12/26
CVC: 123
```

---

## 📊 Base de Datos

### Tablas Principales
- `guests` - Huéspedes con datos bancarios
- `owners` - Propietarios con comisiones
- `properties` - Inmuebles
- `rooms` - Habitaciones
- `reservations` - Reservas con estado y precio
- `invoices` - Facturas generadas
- `documents` - Documentos almacenados

Ver [types.ts](./types.ts) para esquema completo.

---

## 🚀 Deployment

### Opciones Recomendadas

**Frontend:**
- Vercel (recomendado)
- Netlify
- GitHub Pages

**Backend:**
- Railway
- Render
- Heroku
- AWS

**Database:**
- Managed MySQL (Railway, PlanetScale)
- AWS RDS
- Digital Ocean

### Variables en Producción
- Usar variables de entorno seguras
- Stripe keys en producción
- Email service configurado
- CORS habilitado solo para dominios permitidos

---

## 🐛 Troubleshooting

### Error: "Cannot GET /api/..."
- Backend no iniciado
- Puerto 3003 en uso
- CORS no configurado

### Error: "Email not configured"
- Variables de entorno no establecidas
- EMAIL_PROVIDER incorrecto
- Credenciales inválidas

### Error de Pagos
- Stripe keys incorrectas
- Webhook no configurado
- Suscripción de Stripe activa


---

## 📋 Roadmap

### ✅ Completado (FASE 0-4)
- Reservaciones y facturación
- Módulos financieros
- Analytics avanzado
- Email y Pagos

### 🔄 Futuro (FASE 5+)
- [ ] Google Calendar sync
- [ ] SMS notifications (Twilio)
- [ ] PDF reports
- [ ] Public API
- [ ] Mobile app
- [ ] Tax integration (SII)

---

## 💡 Tips de Uso

1. **Crear Reserva**: Haz clic en el calendario → Selecciona huésped → Confirma
2. **Marcar como Cobrado**: Reservas → Editar → Guardar
3. **Ver Historial**: Huéspedes → Editar → Tab "Historial"
4. **Exportar Datos**: Analytics → Tab deseado → "Exportar CSV"

---

## 🤝 Contribuir

Este proyecto está completado como versión 1.0. Para mejoras contacta al equipo de desarrollo.

---

## 📄 Licencia

Copyright © 2026 Beds25 PMS. Todos los derechos reservados.

---

## 📞 Contacto

- **Email**: support@beds25.com
- **Docs**: Consulta los archivos .md en la raíz del proyecto
- **Issues**: Reporte bugs al equipo de soporte

---

**Última actualización:** Feb 8, 2026  
**Versión:** 1.0 (Production Ready)  
**Desarrolladores:** Tu Equipo  

🎉 **¡Gracias por usar Beds25 PMS!**
