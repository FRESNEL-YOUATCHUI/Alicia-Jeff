
import { requirePhotographer } from '../_lib/auth.mjs';
import { supabaseAdmin } from '../_lib/supabase.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      error: 'Méthode non autorisée.',
    });
  }

  try {
    const user = await requirePhotographer(req);

    if (!user) {
      return res.status(401).json({
        error: 'Accès photographe non autorisé.',
      });
    }

    const [
      albumsResult,
      photosResult,
      settingsResult,
      messagesResult,
      countResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('wedding_albums')
        .select('id,title,published,hidden,created_at')
        .order('created_at'),

      supabaseAdmin
        .from('wedding_photos')
        .select('id,album_id,storage_path,caption,hidden')
        .order('created_at'),

      supabaseAdmin
        .from('wedding_settings')
        .select('gallery_published')
        .eq('id', 1)
        .single(),

      supabaseAdmin
        .from('wedding_messages')
        .select('id,author,body,hidden,created_at')
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('wedding_rsvps')
        .select('id', { count: 'exact', head: true }),
    ]);

    const results = [
      albumsResult,
      photosResult,
      settingsResult,
      messagesResult,
      countResult,
    ];

    const failed = results.find(result => result.error);

    if (failed) {
      console.error('Supabase admin state:', failed.error);

      return res.status(500).json({
        error: 'Impossible de charger les données.',
      });
    }

    const photos = photosResult.data || [];
    const paths = photos.map(photo => photo.storage_path);

    let signedUrls = [];

    if (paths.length > 0) {
      const { data, error } =
        await supabaseAdmin.storage
          .from('wedding-photos')
          .createSignedUrls(paths, 3600);

      if (error) {
        console.error('Signed URLs:', error);

        return res.status(500).json({
          error: 'Impossible de charger les photographies.',
        });
      }

      signedUrls = data || [];
    }

    const albums = (albumsResult.data || []).map(album => ({
      id: album.id,
      title: album.title,
      published: album.published,
      hidden: album.hidden,
      photos: photos
        .map((photo, index) => ({ photo, index }))
        .filter(item => item.photo.album_id === album.id)
        .map(({ photo, index }) => ({
          id: photo.id,
          caption: photo.caption || '',
          hidden: photo.hidden,
          url: signedUrls[index]?.signedUrl || '',
        })),
    }));

    return res.status(200).json({
      albums,
      settings: {
        galleryPublished:
          settingsResult.data.gallery_published,
      },
      messages: (messagesResult.data || []).map(message => ({
        id: message.id,
        author: message.author,
        body: message.body,
        hidden: message.hidden,
      })),
      response_count: countResult.count || 0,
    });
  } catch (error) {
    console.error('Admin state:', error);

    return res.status(500).json({
      error: 'Erreur interne du serveur.',
    });
  }
}
