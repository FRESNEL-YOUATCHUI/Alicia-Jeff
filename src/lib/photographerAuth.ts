
import { supabase } from './supabase';

export async function loginPhotographer(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw new Error('Identifiants incorrects.');
  }

  const userId = data.user.id;

  const { data: staff, error: roleError } =
    await supabase
      .from('wedding_staff')
      .select('role')
      .eq('user_id', userId)
      .single();

  if (
    roleError ||
    !staff ||
    !['photographer', 'admin'].includes(staff.role)
  ) {
    await supabase.auth.signOut();
    throw new Error(
      "Ce compte n'est pas autorisé à gérer les photos."
    );
  }

  return data.user;
}

export async function logoutPhotographer() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(
      'Impossible de terminer la session.'
    );
  }
}

export async function getPhotographerSession() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const { data: staff, error: roleError } =
    await supabase
      .from('wedding_staff')
      .select('role')
      .eq('user_id', data.user.id)
      .single();

  if (
    roleError ||
    !staff ||
    !['photographer', 'admin'].includes(staff.role)
  ) {
    return null;
  }

  return data.user;
}
