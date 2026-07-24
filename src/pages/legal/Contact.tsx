import { useState } from 'react';
import { Mail, MapPin, Send } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // MVP : ouverture mailto (pas de backend mail encore)
    const subject = encodeURIComponent(`[AfriZone] Message de ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}\n${email}`);
    window.location.href = `mailto:contact@afrizone.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-sm text-[#FF6B00] font-bold mb-2">Contact</p>
        <h1 className="text-3xl font-extrabold text-[#1F2937] mb-2">Nous écrire</h1>
        <p className="text-sm text-gray-500 mb-8">
          Une question sur une commande, un compte vendeur ou un colis ? On vous répond.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Mail className="text-[#FF6B00] shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold">Email</p>
                <a href="mailto:contact@afrizone.com" className="text-[#FF6B00]">
                  contact@afrizone.com
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="text-[#FF6B00] shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold">Siège</p>
                <p className="text-gray-600">Route de Ngor, Dakar, Sénégal</p>
              </div>
            </div>
            <p className="text-gray-500 text-xs pt-2">
              Horaires support indicatifs : lun–sam 9h–19h (GMT).
            </p>
          </div>

          <form onSubmit={onSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-bold mb-1">Nom</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Message</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none resize-none"
              />
            </div>
            {sent && (
              <p className="text-sm text-green-700">
                Votre client mail va s’ouvrir pour envoyer le message.
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl font-bold inline-flex items-center justify-center gap-2"
            >
              Envoyer <Send size={16} />
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
