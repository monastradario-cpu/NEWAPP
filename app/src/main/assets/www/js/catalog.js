/* Casa Mia — catalogo base: mobili, materiali, impianti, prezzi indicativi, stili */
(function (root) {
  'use strict';
  const CM = root.CM;

  /* ---------- Categorie (arredo e materiali) ---------- */
  CM.CATEGORIES = [
    { id: 'soggiorno', label: 'Soggiorno' },
    { id: 'cucina', label: 'Cucina' },
    { id: 'camera', label: 'Camera da letto' },
    { id: 'bagno', label: 'Bagno e sanitari' },
    { id: 'elettrodomestici', label: 'Elettrodomestici' },
    { id: 'elettronica', label: 'TV ed elettronica' },
    { id: 'illuminazione', label: 'Illuminazione' },
    { id: 'tessili', label: 'Tende, tappeti e tessili' },
    { id: 'decorazioni', label: 'Decorazioni' },
    { id: 'studio', label: 'Studio e ufficio' },
    { id: 'esterni', label: 'Esterni e giardino' },
    { id: 'pavimenti', label: 'Piastrelle e pavimenti' },
    { id: 'pitture', label: 'Pitture e carte da parati' },
    { id: 'serramenti', label: 'Porte e finestre' },
    { id: 'altro', label: 'Altro' }
  ];
  CM.categoryLabel = (id) => (CM.CATEGORIES.find(c => c.id === id) || { label: 'Altro' }).label;
  CM.MATERIAL_CATS = ['pavimenti', 'pitture'];

  /* ---------- Mobili base (misure in metri) ----------
     shape: guida il simbolo in pianta e la forma nel 3D
     elev: altezza da terra (pensili, quadri, luci a soffitto)       */
  const F = (id, name, cat, w, d, h, shape, color, extra) => Object.assign({ id, name, cat, w, d, h, shape, color, elev: 0, base: true }, extra || {});
  CM.FURNITURE_BASE = [
    // Soggiorno
    F('divano3', 'Divano 3 posti', 'soggiorno', 2.10, 0.92, 0.85, 'sofa', '#8C9AAE'),
    F('divano2', 'Divano 2 posti', 'soggiorno', 1.60, 0.90, 0.85, 'sofa', '#8C9AAE'),
    F('divanoang', 'Divano angolare', 'soggiorno', 2.70, 1.70, 0.85, 'sofa_l', '#8C9AAE'),
    F('poltrona', 'Poltrona', 'soggiorno', 0.85, 0.85, 0.90, 'armchair', '#B38B6D'),
    F('tavolino', 'Tavolino da caffè', 'soggiorno', 1.10, 0.60, 0.42, 'table', '#C9A27E'),
    F('tavolo6', 'Tavolo da pranzo 6 posti', 'soggiorno', 1.80, 0.90, 0.75, 'table', '#C9A27E'),
    F('tavolo4', 'Tavolo da pranzo 4 posti', 'soggiorno', 1.20, 0.80, 0.75, 'table', '#C9A27E'),
    F('tavolotondo', 'Tavolo rotondo', 'soggiorno', 1.10, 1.10, 0.75, 'round_table', '#C9A27E'),
    F('sedia', 'Sedia', 'soggiorno', 0.45, 0.52, 0.85, 'chair', '#6F5B4B'),
    F('mobiletv', 'Mobile TV', 'soggiorno', 1.80, 0.42, 0.50, 'cabinet', '#D9D4CB'),
    F('libreria', 'Libreria', 'soggiorno', 0.90, 0.35, 2.00, 'shelf', '#C9A27E'),
    F('credenza', 'Credenza', 'soggiorno', 1.60, 0.45, 0.85, 'cabinet', '#C9A27E'),
    // Cucina componibile
    F('k-base30', 'Base 30 cm', 'cucina', 0.30, 0.60, 0.90, 'kitchen_base', '#EDEBE6'),
    F('k-base45', 'Base 45 cm', 'cucina', 0.45, 0.60, 0.90, 'kitchen_base', '#EDEBE6'),
    F('k-base60', 'Base 60 cm', 'cucina', 0.60, 0.60, 0.90, 'kitchen_base', '#EDEBE6'),
    F('k-base80', 'Base 80 cm', 'cucina', 0.80, 0.60, 0.90, 'kitchen_base', '#EDEBE6'),
    F('k-base90', 'Base 90 cm', 'cucina', 0.90, 0.60, 0.90, 'kitchen_base', '#EDEBE6'),
    F('k-lavello80', 'Base lavello 80 cm', 'cucina', 0.80, 0.60, 0.90, 'sink', '#EDEBE6'),
    F('k-lavello120', 'Base lavello 120 cm', 'cucina', 1.20, 0.60, 0.90, 'sink', '#EDEBE6'),
    F('k-cottura60', 'Base piano cottura 60 cm', 'cucina', 0.60, 0.60, 0.90, 'hob', '#EDEBE6'),
    F('k-cottura90', 'Base piano cottura 90 cm', 'cucina', 0.90, 0.60, 0.90, 'hob', '#EDEBE6'),
    F('k-pensile30', 'Pensile 30 cm', 'cucina', 0.30, 0.35, 0.72, 'kitchen_wall', '#EDEBE6', { elev: 1.45 }),
    F('k-pensile60', 'Pensile 60 cm', 'cucina', 0.60, 0.35, 0.72, 'kitchen_wall', '#EDEBE6', { elev: 1.45 }),
    F('k-pensile90', 'Pensile 90 cm', 'cucina', 0.90, 0.35, 0.72, 'kitchen_wall', '#EDEBE6', { elev: 1.45 }),
    F('k-cappa', 'Pensile cappa 60 cm', 'cucina', 0.60, 0.35, 0.72, 'kitchen_wall', '#C8CCD1', { elev: 1.45 }),
    F('k-colforno', 'Colonna forno 60 cm', 'cucina', 0.60, 0.60, 2.16, 'kitchen_tall', '#EDEBE6'),
    F('k-colfrigo', 'Colonna frigo 60 cm', 'cucina', 0.60, 0.60, 2.16, 'kitchen_tall', '#EDEBE6'),
    F('k-isola', 'Isola / penisola', 'cucina', 1.80, 0.90, 0.90, 'kitchen_base', '#EDEBE6'),
    F('sgabello', 'Sgabello', 'cucina', 0.40, 0.40, 0.75, 'chair', '#6F5B4B'),
    // Camera
    F('letto160', 'Letto matrimoniale 160', 'camera', 1.70, 2.10, 0.95, 'bed', '#E8E1D6'),
    F('letto180', 'Letto king 180', 'camera', 1.90, 2.15, 0.95, 'bed', '#E8E1D6'),
    F('letto90', 'Letto singolo 90', 'camera', 0.98, 2.05, 0.90, 'bed', '#E8E1D6'),
    F('letto120', 'Letto una piazza e mezza', 'camera', 1.28, 2.05, 0.90, 'bed', '#E8E1D6'),
    F('comodino', 'Comodino', 'camera', 0.45, 0.40, 0.50, 'cabinet', '#C9A27E'),
    F('armadio2', 'Armadio 2 ante', 'camera', 1.00, 0.60, 2.30, 'wardrobe', '#EDEBE6'),
    F('armadio4', 'Armadio 4 ante', 'camera', 2.00, 0.60, 2.30, 'wardrobe', '#EDEBE6'),
    F('armadio6', 'Armadio 6 ante', 'camera', 3.00, 0.60, 2.50, 'wardrobe', '#EDEBE6'),
    F('cassettiera', 'Cassettiera', 'camera', 0.90, 0.48, 0.85, 'cabinet', '#C9A27E'),
    F('scrivaniacam', 'Scrivania', 'camera', 1.20, 0.60, 0.75, 'desk', '#C9A27E'),
    // Bagno
    F('wc', 'Vaso WC sospeso', 'bagno', 0.36, 0.54, 0.40, 'wc', '#FFFFFF'),
    F('bidet', 'Bidet sospeso', 'bagno', 0.36, 0.54, 0.40, 'bidet', '#FFFFFF'),
    F('lavabo60', 'Lavabo con mobile 60', 'bagno', 0.60, 0.46, 0.85, 'basin', '#FFFFFF'),
    F('lavabo80', 'Lavabo con mobile 80', 'bagno', 0.80, 0.46, 0.85, 'basin', '#FFFFFF'),
    F('doccia80', 'Piatto doccia 80x80', 'bagno', 0.80, 0.80, 2.00, 'shower', '#DDE7EA'),
    F('doccia120', 'Piatto doccia 120x80', 'bagno', 1.20, 0.80, 2.00, 'shower', '#DDE7EA'),
    F('vasca', 'Vasca 170x70', 'bagno', 1.70, 0.70, 0.56, 'bath', '#FFFFFF'),
    F('specchiobagno', 'Specchio bagno', 'bagno', 0.70, 0.04, 0.80, 'mirror', '#CFE0E6', { elev: 1.10 }),
    // Elettrodomestici
    F('frigo', 'Frigorifero libera installazione', 'elettrodomestici', 0.60, 0.65, 1.85, 'fridge', '#E6E8EA'),
    F('frigo2', 'Frigorifero doppia porta', 'elettrodomestici', 0.91, 0.72, 1.78, 'fridge', '#C8CCD1'),
    F('lavatrice', 'Lavatrice', 'elettrodomestici', 0.60, 0.60, 0.85, 'washer', '#F2F3F4'),
    F('asciugatrice', 'Asciugatrice', 'elettrodomestici', 0.60, 0.62, 0.85, 'washer', '#F2F3F4'),
    F('lavastoviglie', 'Lavastoviglie 60', 'elettrodomestici', 0.60, 0.60, 0.85, 'kitchen_base', '#EDEBE6'),
    F('forno', 'Forno da incasso', 'elettrodomestici', 0.60, 0.56, 0.60, 'cabinet', '#3A3F46'),
    // Elettronica
    F('tv55', 'TV 55 pollici', 'elettronica', 1.23, 0.08, 0.71, 'tv', '#1B1E22', { elev: 0.55 }),
    F('tv65', 'TV 65 pollici', 'elettronica', 1.45, 0.08, 0.83, 'tv', '#1B1E22', { elev: 0.55 }),
    F('soundbar', 'Soundbar', 'elettronica', 0.90, 0.10, 0.07, 'box', '#1B1E22', { elev: 0.50 }),
    F('pc', 'Postazione PC', 'elettronica', 0.60, 0.25, 0.45, 'tv', '#1B1E22', { elev: 0.75 }),
    // Illuminazione
    F('lampterra', 'Lampada da terra', 'illuminazione', 0.35, 0.35, 1.70, 'lamp_floor', '#D9C08C', { light: true }),
    F('lampsoff', 'Lampadario a soffitto', 'illuminazione', 0.50, 0.50, 0.30, 'lamp_ceiling', '#F1E7C9', { light: true, elev: 2.30 }),
    F('lampsosp', 'Lampada a sospensione', 'illuminazione', 0.40, 0.40, 0.35, 'lamp_ceiling', '#F1E7C9', { light: true, elev: 1.90 }),
    F('lamptavolo', 'Lampada da tavolo', 'illuminazione', 0.25, 0.25, 0.45, 'lamp_floor', '#D9C08C', { light: true, elev: 0.50 }),
    // Tessili
    F('tappeto200', 'Tappeto 200x140', 'tessili', 2.00, 1.40, 0.01, 'rug', '#C7B9A6'),
    F('tappeto160', 'Tappeto 160x230', 'tessili', 1.60, 2.30, 0.01, 'rug', '#B8A68F'),
    F('tenda', 'Tenda', 'tessili', 1.40, 0.08, 2.50, 'curtain', '#E9E3D6'),
    // Decorazioni
    F('pianta', 'Pianta in vaso', 'decorazioni', 0.45, 0.45, 1.20, 'plant', '#5E8C61'),
    F('quadro', 'Quadro', 'decorazioni', 0.80, 0.03, 0.60, 'picture', '#7A8FA6', { elev: 1.30 }),
    F('specchio', 'Specchio da terra', 'decorazioni', 0.60, 0.05, 1.70, 'mirror', '#CFE0E6'),
    // Studio
    F('scrivania', 'Scrivania', 'studio', 1.40, 0.70, 0.75, 'desk', '#C9A27E'),
    F('sediaufficio', 'Sedia da ufficio', 'studio', 0.60, 0.60, 1.10, 'chair', '#3A3F46'),
    F('cassettiera-uff', 'Cassettiera', 'studio', 0.42, 0.55, 0.60, 'cabinet', '#D9D4CB'),
    // Esterni
    F('tavoloest', 'Tavolo da esterno', 'esterni', 1.60, 0.90, 0.74, 'table', '#8A7A66'),
    F('sdraio', 'Sdraio', 'esterni', 0.70, 1.90, 0.40, 'lounger', '#D9D4CB'),
    F('ombrellone', 'Ombrellone', 'esterni', 3.00, 3.00, 2.50, 'umbrella', '#E7DCC4'),
    F('albero', 'Albero', 'esterni', 3.00, 3.00, 5.00, 'tree', '#5E8C61'),
    F('siepe', 'Siepe', 'esterni', 3.00, 0.60, 1.50, 'hedge', '#5E8C61'),
    F('pergola', 'Pergola', 'esterni', 3.00, 4.00, 2.50, 'pergola', '#8A7A66'),
    F('gazebo', 'Gazebo', 'esterni', 3.00, 3.00, 2.70, 'pergola', '#E7DCC4'),
    F('auto', 'Automobile', 'esterni', 1.85, 4.40, 1.50, 'car', '#7A8FA6'),
    F('barbecue', 'Barbecue', 'esterni', 1.20, 0.60, 1.10, 'cabinet', '#3A3F46'),
    F('vialetto', 'Vialetto', 'esterni', 1.00, 4.00, 0.03, 'path', '#C9C2B4'),
    F('recinzione', 'Recinzione', 'esterni', 3.00, 0.06, 1.20, 'fence', '#8A7A66'),
    F('cancello', 'Cancello', 'esterni', 3.00, 0.08, 1.60, 'fence', '#3A3F46'),
    F('aiuola', 'Aiuola', 'esterni', 2.00, 0.80, 0.30, 'hedge', '#7FA05F'),
    // Modelli 3D realistici (scaricati quando servono; Creative Commons BY 4.0, Wayfair e DGG / Khronos)
    F('r3d-divano-velluto', 'Divano in velluto (3D realistico)', 'soggiorno', 2.19, 1.02, 0.79, 'sofa', '#C9A0A8', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb', store: 'Wayfair · CC BY 4.0', real3d: true }),
    F('r3d-divano-pelle', 'Divano in pelle e legno (3D realistico)', 'soggiorno', 2.73, 0.92, 1.12, 'sofa', '#7A5638', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenWoodLeatherSofa/glTF-Binary/SheenWoodLeatherSofa.glb', store: 'DGG · CC BY 4.0', real3d: true }),
    F('r3d-poltrona', 'Poltroncina in velluto (3D realistico)', 'soggiorno', 0.83, 0.57, 0.69, 'armchair', '#8FA48C', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb', store: 'Wayfair · CC BY 4.0', real3d: true }),
    F('r3d-poltrona-damasco', 'Poltroncina damascata (3D realistico)', 'soggiorno', 0.83, 0.57, 0.69, 'armchair', '#6E4A7A', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChairDamaskPurplegold/glTF-Binary/ChairDamaskPurplegold.glb', store: 'Wayfair · CC BY 4.0', real3d: true }),
    F('r3d-pouf', 'Pouf basso in seta (3D realistico)', 'soggiorno', 0.61, 0.61, 0.20, 'box', '#C9B8A3', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SpecularSilkPouf/glTF-Binary/SpecularSilkPouf.glb', store: 'Wayfair · CC BY 4.0', real3d: true }),
    F('r3d-lampada-arco', 'Lampada da terra ad arco (3D realistico)', 'illuminazione', 1.13, 0.72, 1.86, 'lamp_floor', '#2B2E33', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/LightsPunctualLamp/glTF-Binary/LightsPunctualLamp.glb', store: 'DGG · CC BY 4.0', real3d: true, light: true }),
    F('r3d-sospensione', 'Lampada a sospensione industriale (3D realistico)', 'illuminazione', 0.30, 0.36, 0.40, 'lamp_ceiling', '#3A3F46', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AnisotropyBarnLamp/glTF-Binary/AnisotropyBarnLamp.glb', store: 'Wayfair · CC BY 4.0', real3d: true, light: true, elev: 2.0 }),
    F('r3d-lampada-tavolo', 'Lampada da tavolo iridescente (3D realistico)', 'illuminazione', 0.30, 0.30, 0.48, 'lamp_floor', '#D8D2C4', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescenceLamp/glTF-Binary/IridescenceLamp.glb', store: 'Wayfair · CC BY 4.0', real3d: true, light: true, elev: 0.75 }),
    F('r3d-pianta', 'Pianta in vaso (3D realistico)', 'decorazioni', 0.70, 0.66, 0.84, 'plant', '#5E8C61', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DiffuseTransmissionPlant/glTF-Binary/DiffuseTransmissionPlant.glb', store: 'DGG · CC BY 4.0', real3d: true }),
    F('r3d-vaso-fiori', 'Vaso di vetro con fiori (3D realistico)', 'decorazioni', 0.33, 0.21, 0.30, 'plant', '#C9D3C4', { model: 'url:https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlassVaseFlowers/glTF-Binary/GlassVaseFlowers.glb', store: 'Khronos · CC BY 4.0', real3d: true, elev: 0.75 })
  ];

  /* ---------- Materiali base (prezzi indicativi, modificabili) ---------- */
  CM.MATERIALS_BASE = [
    { id: 'm-gres-legno', type: 'piastrella', cat: 'pavimenti', name: 'Gres effetto legno 20×120', tw: 0.20, th: 1.20, boxM2: 1.44, price: 28, color: '#B98E62', tex: 'wood' },
    { id: 'm-gres-cemento', type: 'piastrella', cat: 'pavimenti', name: 'Gres effetto cemento 60×60', tw: 0.60, th: 0.60, boxM2: 1.44, price: 22, color: '#A9A7A2', tex: 'tile' },
    { id: 'm-gres-marmo', type: 'piastrella', cat: 'pavimenti', name: 'Gres effetto marmo 60×120', tw: 0.60, th: 1.20, boxM2: 1.44, price: 35, color: '#E6E2DC', tex: 'marble' },
    { id: 'm-ceramica-bagno', type: 'piastrella', cat: 'pavimenti', name: 'Rivestimento ceramica 20×20', tw: 0.20, th: 0.20, boxM2: 1.0, price: 18, color: '#DCE6EA', tex: 'tile' },
    { id: 'm-mosaico', type: 'piastrella', cat: 'pavimenti', name: 'Mosaico 30×30', tw: 0.30, th: 0.30, boxM2: 0.9, price: 45, color: '#9FB8C2', tex: 'tile' },
    { id: 'm-parquet-rovere', type: 'parquet', cat: 'pavimenti', name: 'Parquet rovere prefinito', tw: 0.15, th: 1.20, boxM2: 1.62, price: 48, color: '#C49A6C', tex: 'wood' },
    { id: 'm-laminato', type: 'parquet', cat: 'pavimenti', name: 'Laminato effetto rovere', tw: 0.19, th: 1.28, boxM2: 2.0, price: 16, color: '#BE9A72', tex: 'wood' },
    { id: 'm-resina', type: 'resina', cat: 'pavimenti', name: 'Resina continua', price: 75, color: '#C9C6C0', tex: 'plain' },
    { id: 'm-microcemento', type: 'resina', cat: 'pavimenti', name: 'Microcemento', price: 90, color: '#BDB8B0', tex: 'concrete' },
    { id: 'm-marmo-carrara', type: 'piastrella', cat: 'pavimenti', name: 'Marmo bianco Carrara 60×60', tw: 0.60, th: 0.60, boxM2: 0.72, price: 95, color: '#EDEBE7', tex: 'marble' },
    { id: 'm-marmo-nero', type: 'piastrella', cat: 'pavimenti', name: 'Marmo nero Marquinia 60×60', tw: 0.60, th: 0.60, boxM2: 0.72, price: 120, color: '#2A2A2C', tex: 'marble' },
    { id: 'm-travertino', type: 'piastrella', cat: 'pavimenti', name: 'Travertino 40×60', tw: 0.40, th: 0.60, boxM2: 0.96, price: 70, color: '#D9C7A6', tex: 'marble' },
    { id: 'm-gres-antracite', type: 'piastrella', cat: 'pavimenti', name: 'Gres effetto cemento antracite 60×60', tw: 0.60, th: 0.60, boxM2: 1.44, price: 24, color: '#5F6062', tex: 'tile' },
    { id: 'm-gres-pietra', type: 'piastrella', cat: 'pavimenti', name: 'Gres effetto pietra 60×60', tw: 1.2, th: 1.2, boxM2: 1.44, price: 30, color: '#A8A39A', tex: 'stone' },
    { id: 'm-esagonette', type: 'piastrella', cat: 'pavimenti', name: 'Esagonette in gres bianche 20×23', tw: 0.20, th: 0.23, boxM2: 0.8, price: 38, color: '#E8E4DC', tex: 'hex' },
    { id: 'm-esagonette-salvia', type: 'piastrella', cat: 'pavimenti', name: 'Esagonette verde salvia 20×23', tw: 0.20, th: 0.23, boxM2: 0.8, price: 42, color: '#8FA48C', tex: 'hex' },
    { id: 'm-esagonette-terracotta', type: 'piastrella', cat: 'pavimenti', name: 'Esagonette terracotta 20×23', tw: 0.20, th: 0.23, boxM2: 0.8, price: 40, color: '#B86B4B', tex: 'hex' },
    { id: 'm-terrazzo', type: 'piastrella', cat: 'pavimenti', name: 'Graniglia (terrazzo) 40×40', tw: 0.40, th: 0.40, boxM2: 0.96, price: 55, color: '#E3DDD2', tex: 'terrazzo' },
    { id: 'm-cotto', type: 'piastrella', cat: 'pavimenti', name: 'Cotto toscano 30×30', tw: 0.30, th: 0.30, boxM2: 1.0, price: 34, color: '#B76A45', tex: 'cotto' },
    { id: 'm-parquet-noce', type: 'parquet', cat: 'pavimenti', name: 'Parquet noce nazionale', tw: 0.12, th: 1.0, boxM2: 1.2, price: 75, color: '#7A5638', tex: 'wood' },
    { id: 'm-parquet-sbiancato', type: 'parquet', cat: 'pavimenti', name: 'Parquet rovere sbiancato', tw: 0.18, th: 1.8, boxM2: 1.94, price: 58, color: '#DCCDB4', tex: 'wood' },
    { id: 'm-parquet-fumo', type: 'parquet', cat: 'pavimenti', name: 'Parquet rovere fumé', tw: 0.18, th: 1.8, boxM2: 1.94, price: 62, color: '#8C6F55', tex: 'wood' },
    { id: 'm-metro-bianche', type: 'rivestimento', cat: 'pavimenti', name: 'Piastrelle metro bianche 7,5×15', tw: 0.15, th: 0.075, boxM2: 0.5, price: 28, color: '#F4F3EF', tex: 'subway' },
    { id: 'm-metro-verdi', type: 'rivestimento', cat: 'pavimenti', name: 'Piastrelle metro verde bottiglia 7,5×15', tw: 0.15, th: 0.075, boxM2: 0.5, price: 32, color: '#3F6B5A', tex: 'subway' },
    { id: 'm-zellige', type: 'rivestimento', cat: 'pavimenti', name: 'Zellige 10×10 blu', tw: 0.10, th: 0.10, boxM2: 0.5, price: 85, color: '#3E5C7A', tex: 'tile' },
    { id: 'm-mattoni', type: 'rivestimento', cat: 'pavimenti', name: 'Mattoni a vista', tw: 0.25, th: 0.065, boxM2: 0.5, price: 45, color: '#A9563A', tex: 'brick' },
    { id: 'm-mattoni-bianchi', type: 'rivestimento', cat: 'pavimenti', name: 'Mattoni a vista bianchi', tw: 0.25, th: 0.065, boxM2: 0.5, price: 48, color: '#E7E2DA', tex: 'brick' },
    { id: 'm-boiserie', type: 'rivestimento', cat: 'pavimenti', name: 'Boiserie bianca', tw: 0.6, th: 1.0, boxM2: 1, price: 70, color: '#F1EFEA', tex: 'boiserie' },
    { id: 'm-boiserie-salvia', type: 'rivestimento', cat: 'pavimenti', name: 'Boiserie verde salvia', tw: 0.6, th: 1.0, boxM2: 1, price: 75, color: '#A9B8A1', tex: 'boiserie' },
    { id: 'm-boiserie-blu', type: 'rivestimento', cat: 'pavimenti', name: 'Boiserie blu polvere', tw: 0.6, th: 1.0, boxM2: 1, price: 75, color: '#7D8FA3', tex: 'boiserie' },
    { id: 'm-pittura-bianca', type: 'pittura', cat: 'pitture', name: 'Idropittura bianca', color: '#F4F3EF', code: 'RAL 9010', resa: 10, canL: 14, price: 4.5 },
    { id: 'm-pittura-grigio', type: 'pittura', cat: 'pitture', name: 'Idropittura grigio perla', color: '#D6D4CF', code: 'NCS S 1502-Y', resa: 10, canL: 5, price: 9 },
    { id: 'm-pittura-salvia', type: 'pittura', cat: 'pitture', name: 'Idropittura verde salvia', color: '#B8C4B0', code: 'NCS S 2010-G30Y', resa: 10, canL: 5, price: 10 },
    { id: 'm-pittura-terracotta', type: 'pittura', cat: 'pitture', name: 'Idropittura terracotta', color: '#C98B6B', code: 'NCS S 3030-Y60R', resa: 10, canL: 5, price: 10 },
    { id: 'm-pittura-blu', type: 'pittura', cat: 'pitture', name: 'Idropittura blu notte', color: '#3E4E66', code: 'NCS S 6020-R90B', resa: 9, canL: 2.5, price: 14 },
    { id: 'm-pittura-lavabile', type: 'pittura', cat: 'pitture', name: 'Smalto murale lavabile (bagno/cucina)', color: '#EDEDE9', code: 'RAL 9016', resa: 11, canL: 5, price: 13 },
    { id: 'm-carta-righe', type: 'carta', cat: 'pitture', name: 'Carta da parati a righe', rollW: 0.53, rollL: 10.05, repeat: 0.53, price: 35, color: '#DCD3C2', tex: 'stripes' },
    { id: 'm-carta-floreale', type: 'carta', cat: 'pitture', name: 'Carta da parati floreale', rollW: 0.53, rollL: 10.05, repeat: 0.64, price: 45, color: '#C9D3C4', tex: 'pattern' },
    { id: 'm-carta-damascata', type: 'carta', cat: 'pitture', name: 'Carta da parati damascata', rollW: 0.53, rollL: 10.05, repeat: 0.53, price: 55, color: '#CBBFA8', tex: 'damask' },
    { id: 'm-carta-geometrica', type: 'carta', cat: 'pitture', name: 'Carta da parati geometrica', rollW: 0.53, rollL: 10.05, repeat: 0.53, price: 42, color: '#D6D2C8', tex: 'geo' },
    { id: 'm-carta-foglie', type: 'carta', cat: 'pitture', name: 'Carta da parati foglie tropicali', rollW: 0.53, rollL: 10.05, repeat: 0.7, price: 58, color: '#DDE3D6', tex: 'leaves' },
    { id: 'm-carta-lino', type: 'carta', cat: 'pitture', name: 'Carta da parati effetto lino', rollW: 0.53, rollL: 10.05, repeat: 0.53, price: 38, color: '#E2DCCF', tex: 'weave' }
  ];

  /* ---------- Impianti ---------- */
  CM.FIXTURES = {
    presa: { label: 'Presa', group: 'elettrico', price: 'punto_elettrico', elev: 0.3 },
    presa_tv: { label: 'Presa TV / rete', group: 'elettrico', price: 'punto_elettrico', elev: 0.3 },
    interruttore: { label: 'Interruttore', group: 'elettrico', price: 'punto_elettrico', elev: 1.1 },
    luce: { label: 'Punto luce a soffitto', group: 'elettrico', price: 'punto_elettrico', elev: 2.6 },
    applique: { label: 'Punto luce a parete', group: 'elettrico', price: 'punto_elettrico', elev: 1.9 },
    quadro: { label: 'Quadro elettrico', group: 'elettrico', price: 'quadro', elev: 1.6 },
    acqua: { label: 'Attacco acqua', group: 'idraulico', price: 'punto_idraulico', elev: 0.5 },
    scarico: { label: 'Scarico', group: 'idraulico', price: 'punto_idraulico', elev: 0.4 },
    termosifone: { label: 'Termosifone', group: 'clima', price: 'termosifone', elev: 0.15 },
    condizionatore: { label: 'Condizionatore', group: 'clima', price: 'condizionatore', elev: 2.2 },
    caldaia: { label: 'Caldaia', group: 'clima', price: 'caldaia', elev: 1.4 }
  };
  CM.FIXTURE_GROUPS = { elettrico: { label: 'Elettrico', color: '#C27C0E' }, idraulico: { label: 'Idraulico', color: '#1F7AB8' }, clima: { label: 'Riscaldamento e clima', color: '#C2410C' } };

  /* ---------- Prezzi indicativi (materiale + manodopera) ----------
     Valori medi di partenza, da sostituire con i tuoi preventivi. */
  CM.PRICES_BASE = {
    demolizione: { label: 'Demolizione tramezzo', unit: '€/m²', mat: 0, lab: 28, group: 'Opere edili' },
    tramezzo: { label: 'Nuovo tramezzo', unit: '€/m²', mat: 18, lab: 32, group: 'Opere edili' },
    smaltimento: { label: 'Smaltimento macerie (per m² demolito)', unit: '€/m²', mat: 0, lab: 8, group: 'Opere edili' },
    porta_battente: { label: 'Porta interna a battente', unit: '€/cad', mat: 280, lab: 120, group: 'Serramenti' },
    porta_scorrevole: { label: 'Porta scorrevole esterno muro', unit: '€/cad', mat: 320, lab: 150, group: 'Serramenti' },
    porta_scomparsa: { label: 'Porta a scomparsa con controtelaio', unit: '€/cad', mat: 450, lab: 300, group: 'Serramenti' },
    finestra: { label: 'Finestra', unit: '€/m²', mat: 450, lab: 80, group: 'Serramenti' },
    portafinestra: { label: 'Portafinestra', unit: '€/m²', mat: 420, lab: 80, group: 'Serramenti' },
    arco: { label: 'Apertura arco / passaggio', unit: '€/cad', mat: 40, lab: 260, group: 'Serramenti' },
    posa_piastrelle: { label: 'Posa piastrelle pavimento', unit: '€/m²', mat: 0, lab: 30, group: 'Finiture' },
    posa_parquet: { label: 'Posa parquet / laminato', unit: '€/m²', mat: 0, lab: 22, group: 'Finiture' },
    posa_rivestimento: { label: 'Posa rivestimento a parete', unit: '€/m²', mat: 0, lab: 35, group: 'Finiture' },
    posa_resina: { label: 'Stesura resina', unit: '€/m²', mat: 0, lab: 0, group: 'Finiture' },
    colla: { label: 'Colla per piastrelle (sacco 25 kg)', unit: '€/sacco', mat: 14, lab: 0, group: 'Finiture' },
    stucco: { label: 'Stucco per fughe', unit: '€/kg', mat: 3.5, lab: 0, group: 'Finiture' },
    battiscopa: { label: 'Battiscopa', unit: '€/m', mat: 6, lab: 4, group: 'Finiture' },
    pittura_lab: { label: 'Imbiancatura (manodopera)', unit: '€/m²', mat: 0, lab: 7, group: 'Finiture' },
    carta_lab: { label: 'Posa carta da parati', unit: '€/rotolo', mat: 0, lab: 15, group: 'Finiture' },
    punto_elettrico: { label: 'Punto elettrico (presa, interruttore, luce)', unit: '€/cad', mat: 25, lab: 55, group: 'Impianti' },
    quadro: { label: 'Quadro elettrico', unit: '€/cad', mat: 250, lab: 200, group: 'Impianti' },
    punto_idraulico: { label: 'Punto idraulico (acqua o scarico)', unit: '€/cad', mat: 40, lab: 110, group: 'Impianti' },
    termosifone: { label: 'Termosifone', unit: '€/cad', mat: 220, lab: 130, group: 'Impianti' },
    condizionatore: { label: 'Condizionatore', unit: '€/cad', mat: 700, lab: 250, group: 'Impianti' },
    caldaia: { label: 'Caldaia', unit: '€/cad', mat: 1500, lab: 400, group: 'Impianti' },
    montaggio_mobili: { label: 'Montaggio mobili (sul prezzo)', unit: '%', mat: 0, lab: 0, group: 'Arredamento' }
  };

  CM.POSE = {
    dritta: { label: 'Dritta', waste: 0.08 },
    sfalsata: { label: 'Sfalsata', waste: 0.10 },
    diagonale: { label: 'Diagonale', waste: 0.15 },
    spina: { label: 'Spina di pesce', waste: 0.18 }
  };

  /* ---------- Stili guidati ---------- */
  // (gli stili sono in style.js)

  // Tipi di mobile "tessuto" o "legno" per applicare uno stile
  CM.SHAPE_FINISH = {
    sofa: 'fabric', sofa_l: 'fabric', armchair: 'fabric', bed: 'fabric', rug: 'fabric', curtain: 'fabric',
    table: 'wood', round_table: 'wood', desk: 'wood', shelf: 'wood', cabinet: 'wood', chair: 'wood', wardrobe: 'wood',
    lamp_floor: 'metal', lamp_ceiling: 'metal', kitchen_base: 'wood', kitchen_wall: 'wood', kitchen_tall: 'wood', basin: 'wood', tv_stand: 'wood', bookcase: 'wood'
  };
})(typeof window !== 'undefined' ? window : globalThis);
