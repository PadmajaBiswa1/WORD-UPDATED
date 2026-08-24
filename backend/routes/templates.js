const router = require('express').Router();
const { createDocument, sanitizeUser } = require('../lib/documentStore');
const { getTemplate, listTemplates } = require('../lib/templates');

function requestUser(req) {
  return sanitizeUser({
    id: req.get('X-EtherX-User-Id') || req.body?.user?.id,
    name: req.get('X-EtherX-User-Name') || req.body?.user?.name,
    email: req.get('X-EtherX-User-Email') || req.body?.user?.email,
  });
}

router.get('/', (_req, res) => {
  res.json({ templates: listTemplates() });
});

router.get('/:id', (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) return res.status(404).json({ message: 'Template not found' });
  res.json(template);
});

router.post('/:id/documents', async (req, res) => {
  try {
    console.log(`[templates] Creating document from template: ${req.params.id}`);
    const template = getTemplate(req.params.id);
    if (!template) {
      console.log(`[templates] Template not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Template not found' });
    }

    const title = req.body?.title || template.title;
    console.log(`[templates] Creating document with title: ${title}`);
    const document = await createDocument(
      {
        title,
        content: template.content,
      },
      requestUser(req),
    );

    console.log(`[templates] Document created successfully: ${document?.id}`);
    res.status(201).json({ document });
  } catch (error) {
    console.error(`[templates] Error creating document from template:`, error);
    res.status(500).json({ 
      message: 'Failed to create document from template',
      error: error?.message || 'Unknown error'
    });
  }
});

module.exports = router;
