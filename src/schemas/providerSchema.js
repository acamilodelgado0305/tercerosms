import { ru } from 'date-fns/locale';
import Joi from 'joi';

const providerSchema = Joi.object({
    tipoIdentificacion: Joi.string().required(),
    numeroIdentificacion: Joi.string().required(),
    nombre: Joi.string().optional(),
    nombreComercial: Joi.string().optional(),
    nombresContacto: Joi.string().allow('').required(),
    apellidosContacto: Joi.string().allow('').required(),
    direccion: Joi.string().required(),
    ciudad: Joi.string().required(),
    departamento: Joi.string().optional(),
    pais: Joi.string().required(),
    tipo: Joi.string().optional(),
    telefono: Joi.array().items(
        Joi.object({
            numero: Joi.string().required(),
            tipo: Joi.string().valid('Personal', 'Oficina', 'Soporte', 'Facturación', 'Otro').required(),
        })
    ).required(),
    correo: Joi.array().items(
        Joi.object({
            email: Joi.string().email().required(),
            tipo: Joi.string().valid('Facturación', 'Soporte', 'Contacto General', 'Otro').required(),
        })
    ).required(),
    camaraComercio: Joi.string().allow('').optional(),
    rut: Joi.string().allow('').optional(''),
    otrosDocumentos: Joi.string().allow('').optional(),
    certificadoBancario: Joi.string().allow('').optional(),
    sitioweb: Joi.string().uri().allow('').optional(),
    medioPago: Joi.string().optional(),
    estado: Joi.string().valid('activo', 'inactivo').default('activo'),
    fechaVencimiento: Joi.date().optional(),
    responsableIva: Joi.string().valid('si', 'no').optional(),
    responsabilidadFiscal: Joi.array()
        .items(
            Joi.string().valid(
                'O-13 - Gran contribuyente',
                'O-15 - Autorretenedor',
                'O-23 - Agente de retención IVA',
                'O-47 - Régimen simple de tributación',
                'R-99-PN - No aplica - Otros'
            )
        )
        .optional(),
});

export { providerSchema };
