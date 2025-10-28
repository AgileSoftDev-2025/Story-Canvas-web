import { Link } from "react-router";

// frontend/src/routes/about.tsx
import React, { useState } from "react";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";

export default function About() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log("Form submitted:", formData);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Hero Section with Logo and Description */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Title and Description */}
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">StoryCanvas</h1>
              <div className="text-base text-gray-800 leading-relaxed space-y-4">
                <p>
                  STORYCANVAS isn't just a tool; it's the future of clear documentation. We redefine software storytelling by blending technical precision with creative vision. Our platform uses NLP and RAG for deep context analysis, then
                  deploys a powerful LLM to instantly generate a full project blueprint: INVEST User Stories, visual PlantUML Wireframes (PNG), and executable Gherkin Test Scenarios. STORYCANVAS stands as the constant force for clarity,
                  empowering architects, developers, and visionaries to bridge the gap between idea and code with unmatched efficiency.
                </p>
              </div>
            </div>

            {/* Right - Logo */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-lg">
                <img src="/Logo_Story_Canvas_Black.svg" alt="StoryCanvas Logo" className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left - Contact Info */}
            <div className="space-y-12">
              {/* Contact & Help */}
              <div className="space-y-5">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Contact & Help</h2>
                </div>
                <div className="pl-13 space-y-2">
                  <p className="text-sm text-gray-700">We are available 24/7, 7 days a week.</p>
                  <p className="text-sm text-gray-900 font-medium">Phone: +6801611112222</p>
                </div>
              </div>

              <hr className="border-gray-300" />

              {/* Write To Us */}
              <div className="space-y-5">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Write To US</h2>
                </div>
                <div className="pl-13 space-y-2">
                  <p className="text-sm text-gray-700">Fill out our form and we will contact you within 24 hours.</p>
                  <p className="text-sm text-gray-900">Emails: customer@exclusive.com</p>
                  <p className="text-sm text-gray-900">Emails: support@exclusive.com</p>
                </div>
              </div>
            </div>

            {/* Right - Contact Form */}
            <div className="bg-white">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name, Email, Phone in one row */}
                <div className="grid grid-cols-3 gap-4">
                  <input
                    type="text"
                    name="name"
                    placeholder="Your Name *"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-100 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5F3D89]"
                  />
                  <input
                    type="email"
                    name="email"
                    placeholder="Your Email *"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-100 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5F3D89]"
                  />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Your Phone *"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-gray-100 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5F3D89]"
                  />
                </div>

                {/* Message textarea */}
                <textarea
                  name="message"
                  placeholder="Your Message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={8}
                  className="w-full px-4 py-3 bg-gray-100 rounded-md text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5F3D89] resize-none"
                />

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button type="submit" className="bg-[#3E4766] text-white px-12 py-4 rounded-md font-medium text-base hover:bg-opacity-90 transition">
                    Send Massage
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
