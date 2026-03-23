export type NewUser = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  imageUrl: string;
  bio: string;
};

export type NavBarLink = {
  imgURL: string;
  route: string;
  label: string;
};

export type NewPost = {
  userId: string;
  caption: string;
  file: File[];
  location?: string;
  tags?: string;
};

export type UpdatePost = {
  postId: string;
  caption: string;
  imageId: string;
  imageUrl: string;
  file: File[];
  location?: string;
  tags?: string;
};
