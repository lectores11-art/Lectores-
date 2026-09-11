# Portadas de biblioteca (bucket público)

## Hecho técnico

Las portadas viven en el bucket Supabase `book-covers` con **lectura pública** (migración `008_book_covers_storage.sql`). Cualquiera con la URL puede ver la imagen, sin ser miembro.

## Riesgo

La tapa de un libro es obra protegida. Un catálogo privado que usa la imagen para identificar el título es menos grave que hospedar el PDF, pero no es riesgo cero. Además la URL pública puede indexarse o reenviarse.

## Decisión de este ciclo (MVP)

- No se pasa el bucket a privado todavía (rompería `<img src={cover_url}>` en toda la app).
- Al subir, la admin debe marcar **que tiene permiso** para esa imagen (material de prensa, dominio público, o autorización).
- El PDF sigue en bucket privado `books` con URL firmada.

## Siguiente paso (cuando el abogado o el tráfico lo pidan)

- Servir portadas con URL firmada de corta duración, o
- Recortar a imágenes propias / material de prensa con licencia explícita.

Hasta entonces: no subir capturas de Amazon ni PDFs escaneados de la tapa “porque queda mejor”.
