import { Outlet } from 'react-router';

export default function AuthLayout() {
  return (
    <div className="min-h-screen md:flex">
      <section className="flex flex-1 justify-center items-center px-6 py-10 md:px-10">
        <Outlet />
      </section>
      <aside className="relative hidden md:block md:w-[44%] lg:w-1/2 overflow-hidden">
        <img
          src="/assets/images/side-img.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </aside>
    </div>
  );
}
