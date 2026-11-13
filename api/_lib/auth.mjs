
import { supabaseAdmin } from './supabase.mjs';

export async function requirePhotographer(req) {
  const authorization = req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  const { data, error } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  const { data: staff, error: roleError } =
    await supabaseAdmin
      .from('wedding_staff')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();

  if (
    roleError ||
    !staff ||
    !['photographer', 'admin'].includes(staff.role)
  ) {
    return null;
  }

  return data.user;
}
