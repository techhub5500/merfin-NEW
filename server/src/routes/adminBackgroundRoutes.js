/**
 * Admin Background Images Routes
 * @description Rotas administrativas para gerenciar imagens de fundo (SEM autenticação)
 * ATENÇÃO: Estas rotas são abertas para facilitar o gerenciamento local
 */

const express = require('express');
const router = express.Router();
const BackgroundImage = require('../database/schemas/background-images-schema');

/**
 * GET /api/admin/backgrounds/list
 * Lista todas as imagens cadastradas (sem base64 para performance)
 */
router.get('/list', async (req, res) => {
  try {
    const images = await BackgroundImage.find({})
      .select('-imageData') // Não retorna o base64 (muito pesado)
      .sort({ page: 1, order: 1, createdAt: -1 });
    
    res.json({
      success: true,
      count: images.length,
      data: images.map(img => ({
        id: img._id,
        name: img.name,
        page: img.page,
        order: img.order,
        size: img.size,
        mimeType: img.mimeType,
        isActive: img.isActive,
        description: img.description,
        displayCount: img.displayCount,
        lastDisplayed: img.lastDisplayed,
        createdAt: img.createdAt
      }))
    });
  } catch (error) {
    console.error('[Admin Backgrounds] Erro ao listar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar imagens'
    });
  }
});

/**
 * GET /api/admin/backgrounds/:id/thumb
 * Retorna thumbnail da imagem (imagem completa por enquanto)
 */
router.get('/:id/thumb', async (req, res) => {
  try {
    const image = await BackgroundImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada' });
    }

    // Retorna a imagem como data URL
    const dataURL = image.toDataURL();
    
    // Redireciona para a imagem em base64
    res.redirect(dataURL);
  } catch (error) {
    console.error('[Admin Backgrounds] Erro ao buscar thumb:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar imagem' });
  }
});

/**
 * POST /api/admin/backgrounds
 * Cria uma nova imagem de fundo
 */
router.post('/', async (req, res) => {
  try {
    const { name, page, imageData, mimeType, order, description, tags, metadata } = req.body;
    
    // Validações básicas
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

    // Limpar prefixo data:image/... se existir
    let cleanImageData = imageData;
    if (imageData.includes(',')) {
      cleanImageData = imageData.split(',')[1];
    }

    // Calcular tamanho
    const size = Buffer.from(cleanImageData, 'base64').length;

    // Verificar limite de 7MB
    if (size > 7 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Imagem muito grande. Máximo 7MB.'
      });
    }

    // Criar nova imagem
    const newImage = new BackgroundImage({
      name,
      page,
      imageData: cleanImageData,
      mimeType,
      order: order || 0,
      description: description || '',
      size,
      tags: tags || [],
      metadata: metadata || {},
      isActive: true
    });

    await newImage.save();

    console.log(`[Admin Backgrounds] Nova imagem criada: ${name} para página ${page}`);

    res.status(201).json({
      success: true,
      message: 'Imagem criada com sucesso',
      data: {
        id: newImage._id,
        name: newImage.name,
        page: newImage.page,
        order: newImage.order,
        size: newImage.size,
        mimeType: newImage.mimeType,
        createdAt: newImage.createdAt
      }
    });
  } catch (error) {
    console.error('[Admin Backgrounds] Erro ao criar:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao criar imagem'
    });
  }
});

/**
 * DELETE /api/admin/backgrounds/:id
 * Remove permanentemente uma imagem
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const image = await BackgroundImage.findByIdAndDelete(id);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Imagem não encontrada'
      });
    }

    console.log(`[Admin Backgrounds] Imagem removida: ${image.name}`);

    res.json({
      success: true,
      message: 'Imagem removida com sucesso'
    });
  } catch (error) {
    console.error('[Admin Backgrounds] Erro ao remover:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover imagem'
    });
  }
});

/**
 * PUT /api/admin/backgrounds/:id
 * Atualiza uma imagem existente
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
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
      data: {
        id: image._id,
        name: image.name,
        page: image.page,
        order: image.order,
        size: image.size
      }
    });
  } catch (error) {
    console.error('[Admin Backgrounds] Erro ao atualizar:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao atualizar imagem'
    });
  }
});

/**
 * POST /api/admin/backgrounds/:id/toggle
 * Ativa/desativa uma imagem
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const image = await BackgroundImage.findById(req.params.id);
    
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Imagem não encontrada'
      });
    }

    image.isActive = !image.isActive;
    await image.save();

    res.json({
      success: true,
      message: `Imagem ${image.isActive ? 'ativada' : 'desativada'}`,
      isActive: image.isActive
    });
  } catch (error) {
    console.error('[Admin Backgrounds] Erro ao alternar:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alternar status'
    });
  }
});

module.exports = router;
