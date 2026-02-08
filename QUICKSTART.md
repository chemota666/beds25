# 🚀 QUICK START GUIDE - Beds25 PMS

## ⚡ 5 Minutos para Comenzar

### 1️⃣ Instalar & Configurar (2 min)

```bash
# Ir al directorio
cd beds25

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env
```

### 2️⃣ Configurar Base de Datos (1 min)

```bash
# Ejecutar migraciones
node scripts/migrate-phase2.js
```

✅ **Resultado:** Base de datos lista

### 3️⃣ Iniciar Servidor (2 min)

**Terminal 1 - Backend:**
```bash
node api/server.js
# ✅ API corriendo en http://localhost:3003
```

**Terminal 2 - Frontend:**
```bash
npm run dev
# ✅ App corriendo en http://localhost:5173
```

### 🎯 ¡Listo!
Abre http://localhost:5173 en tu navegador

---

## 🗺️ NAVEGACIÓN RÁPIDA

### Menú Principal (Sidebar)

| Icono | Sección | Acceso |
|-------|---------|--------|
| 📅 | **Dashboard** | Calendario de reservas |
| 👥 | **Huéspedes** | Base de huéspedes |
| 🏠 | **Propiedades** | Gestión inmuebles |
| 🤵 | **Propietarios** | Datos propietarios |
| 🧾 | **Reservas** | Pagos y facturas (FASE 1) |
| 📊 | **Analytics** | Dashboard de reportes (FASE 3) |

---

## 📋 TAREAS COMUNES

### 1. Crear una Reserva

```
1. Dashboard (inicio)
2. Haz clic en el calendario
3. Selecciona fechas
4. Elige huésped
5. Ingresa cantidad
6. Confirma
```

### 2. Marcar como Pagado

```
1. Reservas
2. Busca la reserva
3. Haz clic en "Editar"
4. Cambia estado
5. Guarda
```

### 3. Ver Número de Factura

```
1. Reservas
2. Busca la reserva
3. Revisa la columna "Factura"
```

### 4. Ver Analytics

```
1. Analytics (menú)
2. Elige tab:
   - KPIs: resumen general
   - Ocupación: ocupación diaria
   - Ingresos: revenue diario
   - Propiedades: métricas por propiedad
   - Propietarios: comisiones y balance
3. Exporta a CSV si necesitas
```

### 5. Agregar Propietario

```
1. Propietarios (menú)
2. Botón "Nuevo Propietario"
3. Completa:
   - Datos personales
   - Datos fiscales (CIF)
   - Datos bancarios (IBAN)
   - Serie de facturación
4. Guarda
```

### 6. Ver Historial Huésped

```
1. Huéspedes (menú)
2. Busca el huésped
3. Haz clic en "Editar"
4. Tab "Historial de Reservas"
5. Ve todas sus reservas
```

---

## 🧪 PRUEBAS RÁPIDAS

### Test Analytics
```
Analytics
Deberías ver:
- KPIs con números
- Gráficos de ocupación
- Tablas de ingresos
- Botones "Exportar CSV"
```

---

## 📊 EJEMPLO DE USO

### Escenario: Nueva Reserva + Pago + Factura

**Día 1: Viernes**
```
1. Cliente llama: "Quiero reservar Habitación 1"
2. Dashboard → Nueva reserva
3. Selecciona: Habitación 1, Huésped Juan, 2 noches
4. ✅ Reserva creada
```

**Día 2: Sábado - Cliente paga**
```
1. Cliente transfiere dinero
2. Reservas → Busca reserva de Juan
3. Editar → Marcar como "Pagado"
4. ✅ Sistema genera factura automáticamente
5. Email enviado a Juan con factura
```

**Día 3: Domingo - Reportes**
```
1. Analytics → Ingresos
2. Verás: +150€ en el día del pago
3. Analytics → Propiedades
4. Verás: Habitación 1 con 1 ocupante
5. Exporta a CSV para contabilidad
```

---

## 🎓 TIPS PROFESIONALES

### 1. Usar Filtros
- **Reservas**: Filtra por propietario para ver su balance
- **Reservas**: Busca por huésped o factura para encontrar rápido
- **Analytics**: Todos los reportes son exportables

### 2. Datos Bancarios
- Agrega IBAN de propietarios en Propietarios
- Sistema calcula automáticamente comisiones
- Exporta "Propietarios" en Analytics para pagos

### 3. Documentos
- Huéspedes → DNI, contrato, recibo fianza
- Accesibles desde tab "Documentos"
- Limitados a 10MB, soportan PDF/JPG/PNG

### 4. Historial
- Huéspedes → Tab "Historial de Reservas"
- Ve todas las reservas pasadas y futuras
- Útil para detectar patrones

### 5. Exportar Datos
- Analytics → Cualquier tab → "Exportar CSV"
- Importa en Excel para análisis avanzados
- Útil para SII/contabilidad

---

## ⚠️ TROUBLESHOOTING

### "Conexión rechazada al puerto 3003"
```bash
# Backend no está corriendo
# Terminal 1: Ejecuta
node api/server.js
```

### "No puedo ver datos"
```bash
# 1. Verifica que MySQL esté corriendo
# 2. Verifica variables en .env
# 3. Reinicia el servidor
```

---

## 📞 SOPORTE RÁPIDO

### Documentación Completa
- `README_UPDATED.md` - Guía general
- `PROJECT_SUMMARY.md` - Resumen de funcionalidades
- `IMPLEMENTATION_SUMMARY.md` - Detalles técnicos

### Archivos de Configuración
- `.env` - Variables de entorno
- `types.ts` - Tipos de datos
- `services/` - Lógica de servicios

---

## ✨ PRÓXIMOS PASOS

### Hoy (Primeros 30 min)
- [ ] ✅ Instalar y correr
- [ ] ✅ Crear 2-3 reservas de prueba
- [ ] ✅ Ver Analytics

### Esta Semana
- [ ] Agregar todos los propietarios
- [ ] Cargar documentos de huéspedes
- [ ] Exportar primer reporte

### Este Mes
- [ ] Entrenar al equipo
- [ ] Migrar datos históricos
- [ ] Backup de base de datos
- [ ] Ir a producción

---

## 🎉 ¡LISTO PARA EMPEZAR!

Tienes todo lo que necesitas. Si algo no funciona:

1. **Revisa .env** - Probablemente ahí está el problema
2. **Reinicia backend** - Ctrl+C, luego nuevamente
3. **Consulta documentación** - Lee los archivos .md
4. **Verifica base de datos** - MySQL corriendo?

**¡Ahora sí, a gestionar propiedades!** 🚀

---

**Última actualización:** Feb 8, 2026  
**Versión:** 1.0  
**Tiempo de lectura:** 5 minutos  
**Tiempo de setup:** 10 minutos  
