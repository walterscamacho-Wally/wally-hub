# Explicación Detallada del Trabajo Realizado

Este documento resume la arquitectura y las funcionalidades clave del ecosistema "Baila Con Wally" para futuras réplicas o consultas.

## 1. Arquitectura del Sistema
El proyecto se diseñó como un **Ecosistema Multi-App Estático**, alojado de forma centralizada pero con rutas independientes. Esto permite que cada herramienta funcione por separado pero bajo la misma identidad de marca.

## 2. Componentes y Funcionalidades

### A. Landing Page (`/index.html`)
- **Diseño**: Minimalista, modo oscuro, con acentos en naranja vibrante.
- **Interactividad**: Cursor personalizado, efectos de scroll reveal, y lightbox para galería.
- **Conversión**: Formulario integrado con WhatsApp para contacto inmediato.

### B. Link-in-bio (`/bio`)
- **Propósito**: Optimizar el tráfico de Instagram.
- **Diseño**: Botones de gran tamaño, optimizado para pulgares en móviles.

### C. Admin Financiero (`/admin`)
- **Tecnología**: JavaScript puro con persistencia en `localStorage`.
- **Funciones**: Registro de transacciones (Salsa, Zumba, Eventos, Gastos), balances en tiempo real y **Generación de Reportes PDF** históricos.

### D. Asistente Coreográfico (`/asistente`)
- **Propósito**: Herramienta de campo para instructores.
- **Funciones**: Guardado de notas por canción y exportación a Word/Texto para compartir con colegas.

### E. Social Planner (`/planner`)
- **Propósito**: Gestión de contenido.
- **Funciones**: Calendario editorial, generador de hooks y exportación a CSV para **Canva Bulk Create**.

## 3. Decisiones Técnicas Clave
- **Sin Bases de Datos Externas**: Se utilizó `localStorage` para que la app sea rápida, privada y no dependa de servidores costosos.
- **Diseño Responsive Progresivo**: Prioridad absoluta en móviles, ya que el 90% del tráfico de un instructor de baile proviene de dispositivos móviles.
- **SEO y Performance**: Uso de etiquetas semánticas y optimización de carga de imágenes.
