// ======================================================================
// Tarea 4 - Almacenamiento y consultas de datos en Big Data (UNAD)
// Caso de uso: plataforma de domicilios de comida en Bogotá
// Estudiante: Angel David Herrera Vergara
// Base de datos: domicilios_db  (colecciones: restaurantes, clientes, pedidos)
// Uso: importar los tres archivos .json y ejecutar cada bloque en mongosh
//      (MongoDB Atlas > Connect > Shell, o la pestaña MONGOSH de Compass).
// ======================================================================


// ---------------------------------------------------------------
// 0. CARGA Y VERIFICACIÓN
// ---------------------------------------------------------------

// Verificación de la carga
db = db.getSiblingDB("domicilios_db");

db.restaurantes.countDocuments()   // 15
db.clientes.countDocuments()       // 30
db.pedidos.countDocuments()        // 110

// Índices sobre las referencias y la fecha
db.pedidos.createIndex({ restaurante_id: 1 });
db.pedidos.createIndex({ cliente_id: 1 });
db.pedidos.createIndex({ fecha: 1 });


// ---------------------------------------------------------------
// 1. CONSULTAS BÁSICAS (CRUD)
// ---------------------------------------------------------------

// Inserción de un pedido de prueba (P9001)
db.pedidos.insertOne({
  _id: "P9001",
  cliente_id: "C007",
  restaurante_id: "R004",
  fecha: new Date("2026-11-17T18:30:00Z"),
  estado: "en_preparacion",
  metodo_pago: "tarjeta_debito",
  items: [
    { codigo: "R004-02", nombre: "Hamburguesa de lentejas",
      cantidad: 2, precio_unitario: 24500 }
  ],
  subtotal: 49000,
  costo_domicilio: 0,
  total: 49000
});

db.pedidos.countDocuments()   // 111

// Selección con filtro, proyección, orden y límite
// Los 5 pedidos entregados más recientes del restaurante R003
db.pedidos.find(
  { restaurante_id: "R003", estado: "entregado" },
  { cliente_id: 1, fecha: 1, total: 1, metodo_pago: 1 }
).sort({ fecha: -1 }).limit(5);

// Un restaurante con campos seleccionados
db.restaurantes.findOne(
  { _id: "R004" },
  { nombre: 1, tipo_cocina: 1, localidad: 1, "menu.nombre": 1, "menu.precio": 1 }
);

// Actualización del pedido P9001
db.pedidos.updateOne(
  { _id: "P9001" },
  { $set: { estado: "entregado", calificacion: 5 } }
);

db.pedidos.findOne({ _id: "P9001" }, { estado: 1, calificacion: 1 });

// Eliminación del pedido P9001
db.pedidos.deleteOne({ _id: "P9001" });

db.pedidos.countDocuments()   // 110 (vuelve al total original)


// ---------------------------------------------------------------
// 2. FILTROS Y OPERADORES
// ---------------------------------------------------------------

// Filtro con $and, $gte e $in
db.pedidos.countDocuments({
  $and: [
    { estado: "entregado" },
    { total: { $gte: 80000 } },
    { metodo_pago: { $in: ["tarjeta_credito", "tarjeta_debito"] } }
  ]
});

// Filtro con $in y $exists sobre un campo opcional
db.clientes.countDocuments({ localidad: { $in: ["Chapinero", "Usaquén"] } });

db.clientes.countDocuments({ membresia: { $exists: true } });

// Filtro con $elemMatch sobre un arreglo de documentos
db.pedidos.countDocuments({
  items: { $elemMatch: { cantidad: { $gte: 3 }, precio_unitario: { $gte: 20000 } } }
});

// Filtro con $exists (campo ausente) y valor booleano
db.pedidos.countDocuments({
  estado: "entregado",
  calificacion: { $exists: false }
});

db.restaurantes.find({ activo: false }, { nombre: 1, localidad: 1 });

// Filtro por rango de fechas
// 05:00 UTC equivale a las 00:00 de Bogotá (UTC-5)
db.pedidos.countDocuments({
  fecha: {
    $gte: new Date("2026-11-01T05:00:00Z"),
    $lt:  new Date("2026-11-16T05:00:00Z")
  }
});

// Filtro con $or, expresión regular y búsqueda en arreglo
db.restaurantes.find(
  { $or: [ { nombre: /^Tacos/ }, { etiquetas: "sushi" } ] },
  { nombre: 1, tipo_cocina: 1, etiquetas: 1 }
);


// ---------------------------------------------------------------
// 3. UNIONES CON $lookup
// ---------------------------------------------------------------

// Unión pedidos–restaurantes con $lookup
db.pedidos.aggregate([
  { $sort: { fecha: 1 } },
  { $limit: 5 },
  { $lookup: {
      from: "restaurantes",
      localField: "restaurante_id",
      foreignField: "_id",
      as: "restaurante"
  } },
  { $unwind: "$restaurante" },
  { $project: {
      restaurante: "$restaurante.nombre",
      tipo_cocina: "$restaurante.tipo_cocina",
      total: 1
  } }
]);

// Unión de tres colecciones: los 5 pedidos de mayor valor
db.pedidos.aggregate([
  { $sort: { total: -1, _id: 1 } },
  { $limit: 5 },
  { $lookup: { from: "clientes", localField: "cliente_id",
               foreignField: "_id", as: "cliente" } },
  { $lookup: { from: "restaurantes", localField: "restaurante_id",
               foreignField: "_id", as: "restaurante" } },
  { $unwind: "$cliente" },
  { $unwind: "$restaurante" },
  { $project: {
      cliente: "$cliente.nombre",
      restaurante: "$restaurante.nombre",
      estado: 1,
      total: 1
  } }
]);


// ---------------------------------------------------------------
// 4. AGREGACIONES (CONTAR, SUMAR, PROMEDIAR)
// ---------------------------------------------------------------

// Conteo de pedidos por estado ($group y $count)
db.pedidos.aggregate([
  { $group: { _id: "$estado", pedidos: { $sum: 1 } } },
  { $sort: { pedidos: -1, _id: 1 } }
]);

db.pedidos.aggregate([
  { $match: { estado: "cancelado" } },
  { $count: "cancelados" }
]);

// Ventas totales y ticket promedio (pedidos entregados)
db.pedidos.aggregate([
  { $match: { estado: "entregado" } },
  { $group: {
      _id: null,
      pedidos: { $sum: 1 },
      ventas_totales: { $sum: "$total" },
      ticket_promedio: { $avg: "$total" },
      pedido_minimo: { $min: "$total" },
      pedido_maximo: { $max: "$total" }
  } },
  { $project: {
      _id: 0, pedidos: 1, ventas_totales: 1,
      ticket_promedio: { $round: ["$ticket_promedio", 0] },
      pedido_minimo: 1, pedido_maximo: 1
  } }
]);

// Ventas por restaurante (los 5 primeros)
db.pedidos.aggregate([
  { $match: { estado: "entregado" } },
  { $group: { _id: "$restaurante_id",
              pedidos: { $sum: 1 },
              ventas: { $sum: "$total" } } },
  { $lookup: { from: "restaurantes", localField: "_id",
               foreignField: "_id", as: "r" } },
  { $unwind: "$r" },
  { $project: {
      _id: 0, restaurante: "$r.nombre", pedidos: 1, ventas: 1,
      ticket_promedio: { $round: [{ $divide: ["$ventas", "$pedidos"] }, 0] }
  } },
  { $sort: { ventas: -1, restaurante: 1 } },
  { $limit: 5 }
]);

// Platos más vendidos (con criterio de desempate)
db.pedidos.aggregate([
  { $match: { estado: "entregado" } },
  { $unwind: "$items" },
  { $group: { _id: "$items.nombre",
              unidades: { $sum: "$items.cantidad" } } },
  { $sort: { unidades: -1, _id: 1 } },   // desempate: nombre A-Z
  { $limit: 5 },
  { $project: { _id: 0, plato: "$_id", unidades: 1 } }
]);

// Ventas y calificación promedio por tipo de cocina
db.pedidos.aggregate([
  { $match: { estado: "entregado" } },
  { $lookup: { from: "restaurantes", localField: "restaurante_id",
               foreignField: "_id", as: "r" } },
  { $unwind: "$r" },
  { $group: {
      _id: "$r.tipo_cocina",
      pedidos: { $sum: 1 },
      ventas: { $sum: "$total" },
      calificacion_promedio: { $avg: "$calificacion" },
      calificaciones: { $sum: { $cond: [{ $isNumber: "$calificacion" }, 1, 0] } }
  } },
  { $project: {
      _id: 0, tipo_cocina: "$_id", pedidos: 1, ventas: 1, calificaciones: 1,
      calificacion_promedio: { $round: ["$calificacion_promedio", 2] }
  } },
  { $sort: { ventas: -1, tipo_cocina: 1 } }
]);

