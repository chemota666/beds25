/**
 * Script to generate the contract .docx template with {placeholders}
 * for docxtemplater. Run once: node scripts/generate-contract-template.js
 */
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, TabStopPosition, TabStopType } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bold = (text) => new TextRun({ text, bold: true, size: 22, font: 'Calibri' });
const normal = (text) => new TextRun({ text, size: 22, font: 'Calibri' });
const italic = (text) => new TextRun({ text, italics: true, size: 22, font: 'Calibri' });
const boldUpper = (text) => new TextRun({ text, bold: true, size: 22, font: 'Calibri', allCaps: true });

const heading = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri' })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 300, after: 200 },
});

const sectionTitle = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri', underline: {} })],
  spacing: { before: 300, after: 100 },
});

const p = (...runs) => new Paragraph({
  children: runs,
  spacing: { after: 100 },
  alignment: AlignmentType.JUSTIFIED,
});

const bullet = (text) => new Paragraph({
  children: [normal(text)],
  bullet: { level: 0 },
  spacing: { after: 50 },
});

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
      },
    },
    children: [
      heading('CONTRATO DE ALQUILER DE HABITACION POR TEMPORADA'),

      p(normal('En {city}, a {contractDate}')),

      sectionTitle('REUNIDOS'),

      p(
        normal('De una parte, D/Da '),
        bold('{ownerName}'),
        normal(', mayor de edad, con DNI '),
        bold('{ownerDni}'),
        normal(' y con domicilio en '),
        bold('{ownerAddress}'),
        normal(', pudiendo ser contactado por teléfono al '),
        bold('{ownerPhone}'),
        normal(' y/o por correo electrónico a la dirección email '),
        bold('{ownerEmail}'),
        normal(', en representación del propietario de la vivienda.'),
      ),

      p(
        normal('De otra parte, D/Dª '),
        bold('{guestFullName}'),
        normal(' mayor de edad, con NIE: '),
        bold('{guestDni}'),
        normal('; pudiendo ser contactado(a) por teléfono al número: '),
        bold('{guestPhone}'),
        normal(' y al email: '),
        bold('{guestEmail}'),
      ),

      sectionTitle('INTERVIENEN'),

      p(
        normal('D/Da '),
        bold('{ownerName}'),
        normal(', en su propio nombre y derecho, como parte propietaria y arrendadora.'),
      ),
      p(
        normal('D/Dª '),
        bold('{guestFullName}'),
        normal(', como parte ARRENDATARIA.'),
      ),

      p(normal('Reconociéndose ambas partes capacidad legal suficiente para el otorgamiento del presente contrato de arrendamiento de uso distinto a vivienda')),

      sectionTitle('MANIFIESTAN Y ACUERDAN'),

      p(
        bold('Primero. - '),
        normal('Que la parte arrendadora es propietaria como gestora de la propiedad situada en '),
        bold('{propertyAddress}'),
        normal(', de la ciudad de '),
        bold('{city}'),
        normal(', cuya superficie y composición, así como demás características son perfectamente conocidas por los intervinientes.'),
      ),

      p(
        bold('Segundo. - '),
        normal('D/Dª '),
        bold('{guestFullName}'),
        normal(' tiene interés en alquilar al arrendador una de las habitaciones en el inmueble, identificada con el nombre '),
        bold('{roomName}'),
        normal('.'),
      ),
      p(normal('El arrendamiento de dicha habitación dará derecho al ARRENDATARIO, junto con el uso exclusivo y excluyente de la habitación objeto del presente contrato, al uso de los demás elementos comunes de la vivienda, en virtud de los pactos que se expondrán a continuación.')),

      p(bold('Tercero. - '), normal('Que a tal objeto formalizan las partes el presente CONTRATO DE ARRENDAMIENTO DE HABITACIÓN POR TEMPORADA EN VIVIENDA COMPARTIDA con arreglo a las siguientes:')),

      heading('ESTIPULACIONES'),

      // PRIMERA
      sectionTitle('Primero. - Del objeto del contrato.'),
      p(normal('El objeto del presente contrato es la habitación descrita en el EXPOSITIVO SEGUNDO que cuenta con el mobiliario y enseres.')),
      p(normal('La habitación se pone a disposición del ARRENDATARIO con la entrega de las llaves de dicha habitación que se hace efectiva en este acto, recibiéndola el ARRENDATARIO, reconociendo el correcto estado de la misma al fin que se destina.')),
      p(normal('Reconociendo, asimismo, la parte arrendataria, disponer de su vivienda habitual mediante la cual satisface su necesidad de vivienda permanente.')),
      p(normal('Junto con el uso exclusivo de la habitación arrendada, el ARRENDATARIO tendrá derecho al uso de los siguientes elementos comunes respetando siempre las normas de la Comunidad de propietarios y los derechos del resto de inquilinos:')),
      bullet('BAÑO'),
      bullet('COCINA'),
      bullet('SALA DE ESTAR'),

      // SEGUNDA
      sectionTitle('Segundo. - De la duración del contrato de arrendamiento.'),
      p(
        normal('a) El plazo de duración de este contrato será de '),
        bold('{durationText}'),
        normal(' ('),
        bold('{durationMonths} meses'),
        normal('), contados desde la firma del presente contrato, por lo que el mismo quedará extinguido por expiración del plazo contractual el día '),
        bold('{endDateFormatted}'),
        normal('.'),
      ),
      p(normal('b) Ambas partes acuerdan que el contrato se renovará posteriormente por periodos mensuales con un máximo de 5 RENOVACIONES, siendo la duración máxima de 11 MESES, siempre y cuando el inquilino no manifieste su voluntad de no renovar con al menos 30 días de anticipación.')),
      p(normal('c) Ambas partes acuerdan que el arrendador podrá finalizar el contrato unilateralmente siempre y cuando se den alguna de las siguientes circunstancias.')),
      bullet('El inquilino no haya abonado el alquiler antes de los CINCO PRIMEROS DIAS DE CADA MES.'),
      bullet('El arrendador manifieste al inquilino su voluntad de rescindir el contrato con al menos 30 días naturales de anticipación.'),
      bullet('El inquilino no cumple con las normas de convivencia con los demás arrendatarios de la propiedad.'),
      p(normal('La expiración del tiempo pactado, o el incumplimiento de las obligaciones por parte del inquilino producirá la automática extinción del contrato, quedando obligado el arrendatario a dejar la habitación libre de enseres a la referida fecha y a disposición de la propiedad, dejando la habitación arrendada en las mismas condiciones existentes en el momento de la ocupación.')),
      p(normal('Se estipula que, si el ARRENDATARIO diera por finalizado el contrato antes del tiempo pactado inicialmente, no tendrá derecho a la devolución de la fianza y deberá comunicarlo al ARRENDADOR con 30 días de antelación.')),

      // TERCERA
      sectionTitle('Tercera. - De la renta.'),
      p(
        normal('La renta por el arrendamiento es de '),
        bold('{rentText}'),
        normal(' ('),
        bold('{rentAmount}€'),
        normal(') mensuales, pagaderos dentro de los cinco primeros días de cada mes. El incumplimiento de la obligación de pago o notificación del justificante del pago en el periodo fijado de una sola mensualidad será motivo de resolución del contrato, dando derecho al arrendador a solicitar el desahucio, siendo por cuenta del arrendatario los gastos que estas acciones originen. La demanda podrá ser instada a partir del día 6 del mes en que el arrendatario hubiera impagado dicha mensualidad (así, por ejemplo, si el día 5 de julio no se hubiera recibido el pago de la mensualidad de julio, la demanda de desahucio se podría interponer a partir del día 6 de julio).'),
      ),
      p(
        normal('El abono de la renta se realizará mediante ingreso o transferencia bancaria en el número de cuenta propiedad de '),
        bold('{ownerName}'),
        normal(', '),
        bold('{ownerIban}'),
        normal(', debiendo enviar justificante de la misma dentro de ese mismo plazo al arrendador a la cuenta de correo electrónico '),
        bold('{ownerEmail}'),
        normal('.'),
      ),
      p(normal('Extinguido el contrato por cualquier causa, si el arrendatario continuara ocupando la vivienda vendrá obligado a indemnizar al ARRENDADOR con una cantidad equivalente al doble de la renta diaria por cada día que transcurra hasta el efectivo desalojo, sin perjuicio de la obligación de abandono de dicha vivienda y de la responsabilidad de dejar la habitación en el mismo estado en el que se encontró.')),

      // CUARTA
      sectionTitle('Cuarto. - De la fianza.'),
      p(
        normal('El arrendatario entrega a su vez al arrendador en este mismo acto el importe de '),
        bold('{rentText}'),
        normal(' ('),
        bold('{rentAmount}€'),
        normal(') por medio de transferencia bancaria, que corresponden a una mensualidad de renta que se satisface en concepto de fianza y la primera mensualidad, constituyendo el presente documento la más eficaz carta de pago.'),
      ),
      p(normal('La ausencia del pago dejará el presente contrato sin efectos.')),
      p(normal('Así mismo, al finalizar el contrato de alquiler en la fecha acordada por el ARRENDATARIO y el ARRENDADOR, la parte arrendataria inspeccionará la habitación en un plazo de 15 días desde la fecha acordada. Una vez transcurrido este plazo el ARRENDATARIO se compromete a realizar la devolución de la fianza el primer viernes después de los 15 días que tiene para inspeccionar la propiedad siempre y cuando el estado de la habitación esté en las condiciones acordadas.')),

      // QUINTA
      sectionTitle('Quinto. - De los gastos e impuestos.'),
      p(normal('Serán de cuenta del arrendador los gastos ordinarios correspondientes a la Comunidad de Propietarios que se giren sobre la vivienda arrendada. La cuota del Impuesto sobre Bienes Inmuebles (IBI) también será satisfecha por el arrendador.')),
      p(normal('Correrá a cargo del arrendador el pago de los suministros de agua, gas, internet o cualquier otro servicio que se necesite o contrate para el inmueble, siempre y cuando los consumos no se extralimiten de los gastos habituales de la vivienda (estipulados). Las facturas del servicio de electricidad (LUZ), estarán a cargo del arrendador siempre y cuando no superen la cuantía de ciento ochenta euros (180€), en el caso de sobrepasar esta cuantía la diferencia entre este límite y la factura proporcionada por la empresa suministradora tendrá que ser abonada por los inquilinos repartida en partes iguales. Las facturas del suministro de agua (AGUA), estarán a cargo del arrendador siempre y cuando no superen la cuantía de cien euros (100€), en el caso de sobrepasar esta cuantía la diferencia entre este límite y la factura proporcionada por la empresa suministradora tendrá que ser abonada por los inquilinos repartida en partes iguales.')),

      // SEXTA
      sectionTitle('Sexto. - De las reparaciones y obras.'),
      p(normal('El ARRENDADOR está obligado a realizar, sin derecho a elevar por ello la renta, todas las reparaciones que sean necesarias para conservar la vivienda y la habitación en las condiciones de habitabilidad para servir al uso convenido, salvo cuando el deterioro de cuya reparación se trate sea imputable al arrendatario a tenor de lo dispuesto en los artículos 1.563 y 1.564 del Código Civil.')),
      p(normal('Por el contrario, las pequeñas reparaciones que exija el desgaste por el uso ordinario de la habitación serán de cargo del arrendatario. Las pequeñas reparaciones que exija el desgaste por el uso ordinario de las zonas comunes serán a cargo de los arrendatarios que en el momento de realizarlas estén ocupando la vivienda en la parte proporcional que corresponda a su habitación.')),
      p(normal('Cualquier pérdida o deterioro o rotura de enseres, mobiliario o electrodoméstico, imputable a un uso indebido o anormal, se repercutirá en el conjunto de los inquilinos, salvo que el responsable sea identificado.')),
      p(normal('A pesar de no tener la consideración de obra, se prohíbe expresamente al arrendatario la realización de agujeros o perforaciones en las paredes del inmueble, conllevando con ello la pérdida total de la fianza.')),
      p(normal('El ARRENDATARIO no podrá llevar a cabo obra alguna ni en la habitación arrendada ni en los elementos comunes, salvo que cuente con el consentimiento previo, expreso y por escrito de la propiedad.')),
      p(normal('Sin perjuicio de la facultad de resolver el contrato, el ARRENDADOR que no haya autorizado la realización de las obras podrá exigir, al concluir el contrato, que el ARRENDATARIO reponga las cosas a su estado anterior o conservar la modificación efectuada, sin que por ello pueda el ARRENDATARIO reclamar compensación o indemnización alguna.')),
      p(normal('La realización de tales obras, así como los gastos y gestiones para la obtención de los oportunos permisos y licencias serán a cargo exclusivo del ARRENDATARIO.')),
      p(normal('A pesar de ello, queda totalmente prohibido para el ARRENDATARIO la realización de obras que modifiquen la configuración de la vivienda o provoquen disminuciones en la estabilidad o seguridad de la misma.')),

      // SÉPTIMA
      sectionTitle('Séptimo. - Del régimen de responsabilidades.'),
      p(normal('El arrendatario exime de toda responsabilidad a la propiedad por los daños que a las cosas o personas se produzcan, y sean consecuencia directa o indirecta del uso y ocupación de la vivienda, ya sean motivadas por omisión, dolo y/o negligencia en el uso del inmueble y sus instalaciones, asumiendo los arrendatarios la responsabilidad civil y/o penal, de los daños que se ocasionen.')),
      p(normal('El arrendador no responde de los daños y perjuicios que puedan ocasionarse al arrendatario por casos fortuitos o fuerza mayor, estimándose como tales las humedades, escapes de agua, cortocircuitos, desprendimientos de cualquier elemento del edificio, y desperfectos que pudiera sufrir el inmueble y sus diversas instalaciones, etc. Tampoco asume la propiedad ninguna clase de responsabilidad en cuanto a la seguridad del inmueble arrendado, ni por los daños que pudieran ocasionarse a las personas, mercancías o cosas existentes, en el mismo, en caso de incendio, robo, hurto, daños y accidentes de toda clase.')),
      p(normal('El arrendador, en todo caso, manifiesta que el inmueble arrendado se encuentra debidamente asegurado.')),

      // OCTAVA
      sectionTitle('Octavo. - De las restantes obligaciones del arrendatario.'),
      p(normal('El arrendatario se compromete a cumplir las obligaciones de convivencia derivadas de los estatutos de la comunidad de vecinos en la que se encuentra el inmueble arrendado, así como a respetar los acuerdos que se adopten y las ordenanzas municipales a tal efecto.')),
      p(normal('Del mismo modo, el arrendatario se obliga a no tener, almacenar o manipular en la vivienda arrendada materias explosivas, inflamables, incómodas, insalubres, peligrosas o ilegales.')),
      p(normal('Con independencia de la facultad resolutoria que le asiste al ARRENDADOR, el retraso en el pago de la renta, incrementos legales o contractuales y gastos de cualesquiera naturalezas en los términos pactados devengará desde que fueren exigibles y hasta el momento de su pago efectivo, un interés de demora a favor del ARRENDADOR calculado en base al interés legal del dinero incrementado en dos puntos, vigente al tiempo de iniciarse la demora.')),
      p(normal('El ARRENDATARIO autoriza el acceso a la vivienda al ARRENDADOR y a las personas por éstos designadas, para que puedan inspeccionar el estado de conservación de la vivienda arrendada, así como de las obras, de todo tipo, que pudieran realizarse en el inmueble, sin previo aviso.')),
      p(normal('El ARRENDATARIO se compromete a dejar la habitación en las mismas condiciones que cuando se le entregó y a libre disposición del ARRENDADOR la HABITACIÓN objeto de este contrato, haciendo entrega de las llaves de la misma en el momento de la resolución del presente contrato.')),
      p(normal('No obstante, lo anterior, cualquier enser que el arrendatario hubiere dejado en la habitación, se considerará abandonado, sin perjuicio de la facultad del arrendador de poder repercutir el coste que hubiere tenido que satisfacer para la retirada del mismo.')),

      // NOVENA
      sectionTitle('Noveno. - De la cesión o subarriendo.'),
      p(normal('El arrendatario no podrá ceder ni subarrendar total o parcialmente la habitación arrendada.')),

      // DÉCIMA
      sectionTitle('Décimo. - De los derechos de tanteo y retracto.'),
      p(normal('El arrendatario renuncia de forma expresa a los derechos de tanteo y de retracto, para los supuestos, "ínter vivos" o "mortis causa", de venta, donación, herencia o adjudicación del inmueble objeto de este contrato, fueran cuales fueran las condiciones y precio en que se llevara a efecto.')),

      // UNDÉCIMA
      sectionTitle('Undécimo. - Domicilio a efecto de notificaciones.'),
      p(normal('Las partes fijan como domicilio a efectos de notificaciones derivadas de la relación contractual el que figura en el encabezamiento del contrato para el arrendador y el de la dirección del inmueble objeto de arriendo para el arrendatario como dirección principal. Deberán notificarse mutuamente una parte a la otra cualquier cambio que se produzca en este sentido.')),
      p(normal('Asimismo, y a fin de facilitar las comunicaciones entre las partes se designan las siguientes direcciones de correo electrónico, Whatsapp siempre que se garantice la autenticidad de la comunicación y de su contenido y quede constancia fehaciente de la emisión y recepción íntegras y del momento en que se hicieron. La no lectura de los mensajes no eximirá al receptor el cumplimiento de dichas notificaciones.')),
      p(normal('Por el arrendatario: '), bold('{guestEmail}')),
      p(normal('Por el arrendador: '), bold('{ownerEmail}')),
      p(normal('Se indica que los móviles de las partes son los siguientes:')),
      p(normal('Por el arrendatario: '), bold('{guestPhone}')),
      p(normal('Por el arrendador: '), bold('{ownerPhone}')),

      // DUODÉCIMA
      sectionTitle('Duodécimo. - De la resolución del contrato de arrendamiento.'),
      p(normal('El incumplimiento de cualquiera de las cláusulas del presente contrato será causa de resolución del mismo, así como por los motivos establecidos en el artículo 27.2 de la Ley de Arrendamientos Urbanos.')),
      p(normal('Asimismo, serán causas de resolución del presente contrato, además de las legalmente establecidas y de las previstas en este contrato, las que expresamente se mencionan a continuación:')),
      bullet('Cuando la habitación arrendada no se destine al uso establecido en el objeto de este contrato.'),
      bullet('Por tenencia de cualquier tipo de animales, incluso domésticos.'),
      bullet('Por causar molestias a los vecinos o a los otros inquilinos, que persistan tras advertencia, ya sea por ruidos, olores, o conductas inapropiadas.'),
      bullet('Cuando la habitación sea ocupada por más de dos personas reiteradas veces, ya que el alquiler es para solo dos personas por habitación.'),

      // DECIMOTERCERA
      sectionTitle('Decimotercero. - Legislación Aplicable.'),
      p(normal('La presente relación se regirá por lo dispuesto en el Código Civil, no siendo aplicable la Ley de Arrendamientos Urbanos.')),

      // DECIMOCUARTA
      sectionTitle('Decimocuarto. - Jurisdicción de los Tribunales.'),
      p(normal('Las partes se someten por imperativo de la Ley a los Juzgados y Tribunales del lugar donde radica el inmueble objeto del presente contrato.')),

      // FIRMA
      new Paragraph({ spacing: { before: 600 } }),
      p(normal('Leído que ha sido el presente documento por las partes intervinientes, lo encuentran acorde con sus voluntades libremente expresadas, y lo firman y rubrican por duplicado ejemplar y a un solo efecto, en prueba de su conformidad, en el lugar y fecha indicados.')),

      new Paragraph({ spacing: { before: 600 } }),
      new Paragraph({
        children: [
          normal('EL ARRENDADOR                                                            EL ARRENDATARIO'),
        ],
        spacing: { after: 600 },
      }),
      new Paragraph({ spacing: { before: 400 } }),
      new Paragraph({
        children: [
          normal('Fdo: {ownerName}                                                      Fdo: {guestFullName}'),
        ],
      }),
    ],
  }],
});

const outputPath = path.join(__dirname, '..', 'templates', 'contrato-habitacion.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`Template generated: ${outputPath}`);
});
