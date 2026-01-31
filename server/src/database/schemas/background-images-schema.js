/**
 * Background Images Schema - Sistema de Rotação de Imagens de Fundo
 * @description Schema para armazenar imagens de fundo que serão exibidas nas páginas
 * As imagens são armazenadas em Base64 no MongoDB e rotacionadas a cada 24 horas
 */

const mongoose = require('mongoose');

const backgroundImageSchema = new mongoose.Schema({
  // Nome identificador da imagem
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Página onde a imagem será exibida (index, dash, invest)
  page: {
    type: String,
    required: true,
    enum: ['index', 'dash', 'invest'],
    index: true
  },
  
  // Imagem em formato Base64
  imageData: {
    type: String,
    required: true
  },
  
  // Tipo MIME da imagem (image/jpeg, image/png, image/webp)
  mimeType: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
    default: 'image/jpeg'
  },
  
  // Ordem de exibição (menor número = prioridade maior)
  order: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Se a imagem está ativa e pode ser exibida
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Descrição opcional da imagem
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Tamanho da imagem em bytes (para controle)
  size: {
    type: Number,
    required: true
  },
  
  // Data da última vez que esta imagem foi exibida
  lastDisplayed: {
    type: Date,
    default: null
  },
  
  // Contador de quantas vezes a imagem foi exibida
  displayCount: {
    type: Number,
    default: 0
  },
  
  // Tags para organização e busca
  tags: [{
    type: String,
    trim: true
  }],
  
  // Metadados adicionais
  metadata: {
    width: Number,
    height: Number,
    uploadedBy: String,
    source: String
  }
}, {
  timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  collection: 'background_images'
});

// Índice composto para busca eficiente
backgroundImageSchema.index({ page: 1, isActive: 1, order: 1 });

// Índice para ordenação temporal
backgroundImageSchema.index({ page: 1, lastDisplayed: 1 });

// Método estático para obter próxima imagem a ser exibida
backgroundImageSchema.statics.getNextImage = async function(page) {
  try {
    // Busca a imagem ativa mais antiga (menos exibida recentemente) para a página
    const image = await this.findOne({
      page: page,
      isActive: true
    })
    .sort({ lastDisplayed: 1, order: 1 })
    .select('-imageData'); // Não retorna o base64 ainda (economia de memória)
    
    return image;
  } catch (error) {
    console.error('[BackgroundImage] Erro ao buscar próxima imagem:', error);
    throw error;
  }
};

// Método estático para obter imagem atual do dia
backgroundImageSchema.statics.getCurrentDayImage = async function(page) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    
    // Busca imagem que foi exibida hoje
    let image = await this.findOne({
      page: page,
      isActive: true,
      lastDisplayed: { $gte: startOfDay }
    });
    
    // Se não houver imagem para hoje, busca a próxima
    if (!image) {
      image = await this.findOne({
        page: page,
        isActive: true
      })
      .sort({ lastDisplayed: 1, order: 1 });
      
      // Atualiza a data de exibição
      if (image) {
        image.lastDisplayed = new Date();
        image.displayCount += 1;
        await image.save();
      }
    }
    
    return image;
  } catch (error) {
    console.error('[BackgroundImage] Erro ao buscar imagem do dia:', error);
    throw error;
  }
};

// Método estático para obter dados da imagem incluindo base64
backgroundImageSchema.statics.getImageWithData = async function(imageId) {
  try {
    const image = await this.findById(imageId);
    return image;
  } catch (error) {
    console.error('[BackgroundImage] Erro ao buscar imagem com dados:', error);
    throw error;
  }
};

// Método para validar tamanho da imagem antes de salvar
backgroundImageSchema.pre('save', function(next) {
  // Limite de 7MB por imagem (Base64 ocupa ~33% mais espaço)
  const MAX_SIZE = 7 * 1024 * 1024; // 7MB
  
  if (this.size > MAX_SIZE) {
    next(new Error(`Imagem muito grande. Tamanho máximo: ${MAX_SIZE / (1024 * 1024)}MB`));
  } else {
    next();
  }
});

// Método de instância para converter para Data URL
backgroundImageSchema.methods.toDataURL = function() {
  if (!this.imageData || !this.mimeType) {
    return null;
  }
  return `data:${this.mimeType};base64,${this.imageData}`;
};

// Método de instância para obter informações públicas (sem base64)
backgroundImageSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    name: this.name,
    page: this.page,
    mimeType: this.mimeType,
    order: this.order,
    description: this.description,
    size: this.size,
    tags: this.tags,
    metadata: this.metadata,
    displayCount: this.displayCount,
    lastDisplayed: this.lastDisplayed,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

const BackgroundImage = mongoose.model('BackgroundImage', backgroundImageSchema);

module.exports = BackgroundImage;
