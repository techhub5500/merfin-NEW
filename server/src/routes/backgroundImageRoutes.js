/**
 * Background Images Routes
 * @description Rotas para gerenciar imagens de fundo rotativas
 */

const express = require('express');
const router = express.Router();
const BackgroundImage = require('../database/schemas/background-images-schema');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * GET /api/backgrounds/stats
 * Retorna estatísticas gerais das imagens (requer autenticação)
 * IMPORTANTE: Esta rota deve vir ANTES das rotas com parâmetros dinâmicos
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await BackgroundImage.aggregate([
      {
        $group: {
          _id: '$page',
          totalImages: { $sum: 1 },
          activeImages: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          totalSize: { $sum: '$size' },
          totalDisplays: { $sum: '$displayCount' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas'
    });
  }
});

/**
 * GET /api/backgrounds/:page/current
 * Retorna a imagem atual do dia para uma página específica
 */
router.get('/:page/current', async (req, res) => {
  try {
    const { page } = req.params;
    
    // Validar página
    if (!['index', 'dash', 'invest'].includes(page)) {
      return res.status(400).json({
        success: false,
        message: 'Página inválida. Use: index, dash ou invest'
      });
    }
    
    // Buscar imagem do dia
    const image = await BackgroundImage.getCurrentDayImage(page);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Nenhuma imagem disponível para esta página'
      });
    }
    
    // Retornar imagem completa com base64
    res.json({
      success: true,
      data: {
        id: image._id,
        name: image.name,
        dataURL: image.toDataURL(),
        description: image.description,
        displayCount: image.displayCount,
        lastDisplayed: image.lastDisplayed
      }
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao buscar imagem atual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar imagem de fundo'
    });
  }
});

/**
 * GET /api/backgrounds/:page/list
 * Lista todas as imagens disponíveis para uma página (sem base64)
 */
router.get('/:page/list', authMiddleware, async (req, res) => {
  try {
    const { page } = req.params;
    
    // Validar página
    if (!['index', 'dash', 'invest'].includes(page)) {
      return res.status(400).json({
        success: false,
        message: 'Página inválida. Use: index, dash ou invest'
      });
    }
    
    const images = await BackgroundImage.find({
      page: page,
      isActive: true
    })
    .select('-imageData')
    .sort({ order: 1, lastDisplayed: 1 });
    
    res.json({
      success: true,
      count: images.length,
      data: images.map(img => img.toPublicJSON())
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao listar imagens:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar imagens'
    });
  }
});

/**
 * POST /api/backgrounds
 * Cria uma nova imagem de fundo (requer autenticação)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      page,
      imageData,
      mimeType,
      order,
      description,
      tags,
      metadata
    } = req.body;
    
    // Validações
    if (!name || !page || !imageData || !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: name, page, imageData, mimeType'
      });
    }
    
    if (!['index', 'dash', 'invest'].includes(page)) {
      return res.status(400).json({
        success: false,
        message: 'Página inválida. Use: index, dash ou invest'
      });
    }
    
    // Remover prefixo data:image/... se presente
    let cleanImageData = imageData;
    if (imageData.includes(',')) {
      cleanImageData = imageData.split(',')[1];
    }
    
    // Calcular tamanho aproximado em bytes
    const size = Buffer.from(cleanImageData, 'base64').length;
    
    // Criar nova imagem
    const newImage = new BackgroundImage({
      name,
      page,
      imageData: cleanImageData,
      mimeType,
      order: order || 0,
      description,
      size,
      tags,
      metadata
    });
    
    await newImage.save();
    
    res.status(201).json({
      success: true,
      message: 'Imagem criada com sucesso',
      data: newImage.toPublicJSON()
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao criar imagem:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao criar imagem'
    });
  }
});

/**
 * PUT /api/backgrounds/:id
 * Atualiza uma imagem existente (requer autenticação)
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remover campos que não devem ser atualizados diretamente
    delete updates._id;
    delete updates.createdAt;
    delete updates.displayCount;
    delete updates.lastDisplayed;
    
    // Se houver nova imageData, recalcular tamanho
    if (updates.imageData) {
      let cleanImageData = updates.imageData;
      if (updates.imageData.includes(',')) {
        cleanImageData = updates.imageData.split(',')[1];
      }
      updates.imageData = cleanImageData;
      updates.size = Buffer.from(cleanImageData, 'base64').length;
    }
    
    const image = await BackgroundImage.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Imagem não encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Imagem atualizada com sucesso',
      data: image.toPublicJSON()
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao atualizar imagem:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao atualizar imagem'
    });
  }
});

/**
 * DELETE /api/backgrounds/:id
 * Desativa uma imagem (não remove do banco) (requer autenticação)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const image = await BackgroundImage.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Imagem não encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Imagem desativada com sucesso',
      data: image.toPublicJSON()
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao desativar imagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desativar imagem'
    });
  }
});

/**
 * POST /api/backgrounds/:id/activate
 * Reativa uma imagem desativada (requer autenticação)
 */
router.post('/:id/activate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const image = await BackgroundImage.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Imagem não encontrada'
      });
    }
    
    res.json({
      success: true,
      message: 'Imagem ativada com sucesso',
      data: image.toPublicJSON()
    });
  } catch (error) {
    console.error('[BackgroundImages API] Erro ao ativar imagem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao ativar imagem'
    });
  }
});

module.exports = router;
