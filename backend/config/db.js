const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');

async function cleanupLegacyUserIndexes() {
  try {
    const usersCollection = mongoose.connection.collection('users');
    const indexes = await usersCollection.indexes();
    const hasLegacyFirebaseIndex = indexes.some((index) => index?.name === 'firebaseUid_1');

    if (hasLegacyFirebaseIndex) {
      await usersCollection.dropIndex('firebaseUid_1');
      console.log('Removed legacy users index: firebaseUid_1');
    }
  } catch (err) {
    // Ignore "ns not found"/missing collection cases during first boot.
    if (err?.codeName === 'NamespaceNotFound') return;
    if (String(err?.message || '').includes('index not found')) return;
    console.warn('Could not clean up legacy users indexes:', err.message);
  }
}

async function connectDB() {
  mongoose.set('bufferCommands', false);
  if (!process.env.MONGO_URI) {
    console.warn('MongoDB disabled: MONGO_URI is not set. Operating in local JSON storage mode.');
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    });
    await cleanupLegacyUserIndexes();
    console.log('MongoDB connected');
    
    // Migrate documents from local JSON if MongoDB is empty
    try {
      const docCount = await Document.countDocuments();
      if (docCount === 0) {
        const jsonPath = path.join(__dirname, '..', 'data', 'documents.json');
        if (fs.existsSync(jsonPath)) {
          console.log('📦 Found local documents.json, starting migration to MongoDB...');
          const raw = fs.readFileSync(jsonPath, 'utf8');
          const parsed = JSON.parse(raw || '{}');
          const docs = Array.isArray(parsed.documents) ? parsed.documents : [];
          if (docs.length > 0) {
            const cleanDocs = docs.map(d => {
              const clean = { ...d };
              delete clean._id;
              return clean;
            });
            await Document.insertMany(cleanDocs);
            console.log(`✅ Successfully migrated ${docs.length} documents to MongoDB!`);
          }
        }
      }
    } catch (migError) {
      console.warn('⚠️ Documents migration failed:', migError.message);
    }
    
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return false;
  }
}

module.exports = connectDB;
