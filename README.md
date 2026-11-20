# Tarea 4 – Almacenamiento y consultas de datos en Big Data (MongoDB)

Curso **Big Data** (código 202016911) · Universidad Nacional Abierta y a Distancia (UNAD)
Estudiante: **Angel David Herrera Vergara** · Noviembre de 2026

Este repositorio contiene la parte individual de la Fase 2 de la Tarea 4: el diseño de una base de datos documental en MongoDB, los datos de prueba y las consultas implementadas (CRUD, filtros, uniones con `$lookup` y agregaciones).

## Caso de uso

Plataforma de **domicilios de comida en Bogotá**. Los restaurantes publican un menú, los clientes hacen pedidos y cada pedido contiene uno o varios platos.

Se eligió un modelo documental porque el pedido es una unidad con una lista de platos de tamaño variable, porque algunos campos son opcionales (`calificacion`, `observaciones`, `membresia`) y porque la colección de pedidos crece con cada compra.

> Los restaurantes y los clientes son **ficticios** y los datos fueron generados para esta actividad. Los correos usan el dominio `example.com`.

## Contenido del repositorio

```
.
├── README.md
├── consultas_mongodb.js      # Consultas (Listados 5 a 21 del informe)
└── data/
    ├── restaurantes.json     # 15 documentos
    ├── clientes.json         # 30 documentos
    └── pedidos.json          # 110 documentos
```

Total: **155 documentos** (la guía exige al menos 100).

## Diseño de la base de datos

Base de datos: `domicilios_db`

| Colección | Documentos | Contenido | Relación |
|---|---|---|---|
| `restaurantes` | 15 | Datos del restaurante y su menú embebido (5 platos) | — |
| `clientes` | 30 | Datos del cliente, direcciones embebidas y membresía opcional | — |
| `pedidos` | 110 | Pedido con su lista de platos embebida | Referencia a `clientes._id` (`cliente_id`) y a `restaurantes._id` (`restaurante_id`) |

Criterio de modelado: se **embebe** lo que se lee junto y es acotado (menú y platos del pedido) y se **referencia** lo que crece sin límite (los pedidos de cada cliente y de cada restaurante). En `pedidos.items` se copian el nombre y el precio del plato al momento de la compra, para que un cambio posterior de precios no altere los pedidos históricos.

Las fechas están en formato JSON extendido (`{"$date": "..."}`) y se almacenan como tipo *Date* en UTC.

## Cómo reproducirlo

### 1. Preparar MongoDB

Se usó un clúster gratuito (M0) de **MongoDB Atlas** con **MongoDB Compass**. También sirve una instalación local de MongoDB.

- Atlas: https://cloud.mongodb.com
- Compass: https://www.mongodb.com/try/download/compass

> No subas al repositorio tu cadena de conexión ni tu contraseña.

### 2. Importar los datos

En Compass, crea la base `domicilios_db` y, en cada colección, usa **ADD DATA → Import JSON or CSV file**:

| Colección | Archivo |
|---|---|
| `restaurantes` | `data/restaurantes.json` |
| `clientes` | `data/clientes.json` |
| `pedidos` | `data/pedidos.json` |

Alternativa por línea de comandos (reemplaza `<CADENA_DE_CONEXION>` por la tuya):

```bash
mongoimport --uri "<CADENA_DE_CONEXION>" --db domicilios_db --collection restaurantes --file data/restaurantes.json --jsonArray
mongoimport --uri "<CADENA_DE_CONEXION>" --db domicilios_db --collection clientes --file data/clientes.json --jsonArray
mongoimport --uri "<CADENA_DE_CONEXION>" --db domicilios_db --collection pedidos --file data/pedidos.json --jsonArray
```

Verificación (en el shell de Compass, `mongosh`):

```js
db = db.getSiblingDB("domicilios_db");
({
  restaurantes: db.restaurantes.countDocuments(),
  clientes: db.clientes.countDocuments(),
  pedidos: db.pedidos.countDocuments()
})
// { restaurantes: 15, clientes: 30, pedidos: 110 }
```

### 3. Ejecutar las consultas

Abre `consultas_mongodb.js` y pega los bloques **de uno en uno** en el shell. Si pegas varias instrucciones juntas, el shell muestra solo el resultado de la última.

Las operaciones de inserción, actualización y eliminación usan un único pedido de prueba (`P9001`) y al final la colección vuelve a tener 110 documentos.

## Consultas y resultados esperados

| Listado | Consulta | Resultado |
|---|---|---|
| 4 | Conteos e índices | 15, 30 y 110 documentos; índices sobre `restaurante_id`, `cliente_id` y `fecha` |
| 5–8 | CRUD sobre el pedido `P9001` | Inserción, selección, actualización y eliminación; la colección vuelve a 110 |
| 9 | `$and`, `$gte`, `$in` | 20 pedidos |
| 10 | `$in`, `$exists` | 5 clientes en Chapinero o Usaquén; 8 con membresía |
| 11 | `$elemMatch` | 23 pedidos |
| 12 | `$exists` | 26 pedidos entregados sin calificación; restaurante inactivo: Burger Sur (R015) |
| 13 | Rango de fechas | 36 pedidos entre el 1 y el 15 de noviembre de 2026 |
| 14 | `$or`, expresión regular, arreglo | Sakura Express y Tacos del Centro |
| 15 | `$lookup` pedidos → restaurantes | Primeros 5 pedidos con su restaurante |
| 16 | `$lookup` de tres colecciones | Los 5 pedidos de mayor valor: P0051, P0084, P0015, P0020 y P0097 |
| 17 | Conteo por estado | 89 entregados, 17 cancelados, 2 en camino y 2 en preparación |
| 18 | Ventas y ticket promedio | 89 pedidos, \$7.439.500 en ventas, ticket promedio de \$83.590 |
| 19 | Ventas por restaurante | Primero: Trattoria Bella Vista (11 pedidos, \$1.418.000) |
| 20 | Platos más vendidos | Capuchino (22), Spaghetti boloñesa (19), Changua (18), Pizza margarita (17), Fettuccine alfredo (16) |
| 21 | Ventas y calificación por tipo de cocina | 8 tipos de cocina; Italiana con las mayores ventas |

Nota sobre el Listado 20: hay un empate en el quinto lugar (Fettuccine alfredo y Tiramisú, 16 unidades). Se desempata por nombre (`_id: 1`), por lo que la consulta es reproducible.

## Notas

- Los datos son sintéticos y de poco volumen: sirven para validar el diseño y las consultas, no para medir rendimiento.
- Los valores monetarios están en pesos colombianos (COP).
- Se probó con MongoDB 8.0 (Atlas, nivel gratuito) y Compass 1.53. Las consultas usan `$round` (MongoDB 4.2 o superior) y `$isNumber` (4.4 o superior).

## Referencias

- MongoDB, Inc. (s. f.). *MongoDB manual*. https://www.mongodb.com/docs/manual/
- MongoDB, Inc. (s. f.). *Data modeling*. https://www.mongodb.com/docs/manual/data-modeling/
- MongoDB, Inc. (s. f.). *\$lookup (aggregation)*. https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/
- MongoDB, Inc. (s. f.). *Aggregation operations*. https://www.mongodb.com/docs/manual/aggregation/
