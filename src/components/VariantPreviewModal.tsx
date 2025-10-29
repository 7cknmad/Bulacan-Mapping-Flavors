import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X as XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Variant } from '../utils/api';

export default function VariantPreviewModal({ open, onClose, variant, restaurantSlug }: { open: boolean; onClose: () => void; variant?: Variant | null; restaurantSlug?: string }) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-4 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-4 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all">
                <div className="flex items-start justify-between">
                  <Dialog.Title className="text-lg font-medium">{variant?.name || 'Variant'}</Dialog.Title>
                  <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700"><XIcon /></button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    {variant?.image_url ? (
                      <img src={variant.image_url} alt={variant.name} className="w-full h-36 object-cover rounded-md bg-neutral-100" onError={(e)=>((e.currentTarget.src='https://via.placeholder.com/320'))} />
                    ) : (
                      <div className="w-full h-36 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-500">No image</div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    {variant?.description ? <p className="text-sm text-neutral-700">{variant.description}</p> : <p className="text-sm text-neutral-500">No description provided.</p>}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-lg font-semibold">{variant?.price ? `₱${Number(variant.price).toFixed(2)}` : 'Price not set'}</div>
                      <div className={`text-sm ${variant?.is_available === false || variant?.is_available === 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {variant?.is_available === false || variant?.is_available === 0 ? 'Unavailable' : 'Available'}
                      </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                      <Link to={`/restaurant/${encodeURIComponent(restaurantSlug || '')}#variant-${variant?.id ?? ''}`} onClick={onClose} className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
                        Go to Restaurant
                      </Link>
                      <button onClick={onClose} className="px-4 py-2 border rounded">Close</button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
