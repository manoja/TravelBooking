import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PolicyType = 'property-rules' | 'terms-conditions' | 'privacy-policy' | 'covid-safety';

interface PolicyContent {
  title: string;
  sections: Array<{
    heading: string;
    content: string | string[];
  }>;
}

@Component({
  selector: 'app-policy-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="onCloseClick()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h1>{{ content().title }}</h1>
            <button class="close-btn" (click)="onCloseClick()" aria-label="Close modal">
              <span>✕</span>
            </button>
          </div>

          <div class="modal-body">
            @for (section of content().sections; track section.heading) {
              <section class="policy-section">
                <h2>{{ section.heading }}</h2>
                @if (isArrayContent(section.content)) {
                  <ul>
                    @for (item of section.content; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                } @else {
                  <p>{{ section.content }}</p>
                }
              </section>
            }
          </div>

          <div class="modal-footer">
            <button class="close-modal-btn" (click)="onCloseClick()">Close</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      max-height: 90vh;
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-50px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      padding: 2rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;

      h1 {
        margin: 0;
        font-size: 1.875rem;
        color: #1f2937;
      }
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #6b7280;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;

      &:hover {
        background: #f3f4f6;
        color: #1f2937;
      }

      span {
        display: block;
        line-height: 1;
      }
    }

    .modal-body {
      overflow-y: auto;
      padding: 2rem;
      flex: 1;
      line-height: 1.8;
      color: #374151;

      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: #f1f5f9;
      }

      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;

        &:hover {
          background: #94a3b8;
        }
      }
    }

    .policy-section {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #e5e7eb;

      &:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }

      h2 {
        font-size: 1.25rem;
        color: #1f2937;
        margin: 0 0 1rem 0;
        font-weight: 600;
      }

      p {
        margin: 0.75rem 0;
      }

      ul {
        margin: 1rem 0;
        padding-left: 2rem;

        li {
          margin-bottom: 0.75rem;
        }
      }
    }

    .modal-footer {
      padding: 1.5rem 2rem;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    .close-modal-btn {
      padding: 0.75rem 1.5rem;
      background: var(--brand, #2563eb);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s ease;

      &:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }
    }

    @media (max-width: 640px) {
      .modal-content {
        max-height: 100vh;
        border-radius: 12px 12px 0 0;
        max-width: 100%;
      }

      .modal-overlay {
        align-items: flex-end;
      }

      .modal-header {
        padding: 1.5rem;

        h1 {
          font-size: 1.5rem;
        }
      }

      .modal-body {
        padding: 1.5rem;
      }

      .modal-footer {
        padding: 1rem 1.5rem;
      }
    }
  `
})
export class PolicyModalComponent {
  readonly isOpen = input.required<boolean>();
  readonly policyType = input.required<PolicyType>();
  readonly closeModal = output<void>();

  readonly content = computed(() => this.getPolicyContent(this.policyType()));

  isArrayContent(content: string | string[]): boolean {
    return Array.isArray(content);
  }

  onCloseClick(): void {
    this.closeModal.emit();
  }

  private getPolicyContent(type: PolicyType): PolicyContent {
    const policies: Record<PolicyType, PolicyContent> = {
      'property-rules': {
        title: 'Property Rules',
        sections: [
          {
            heading: 'Check-in & Check-out',
            content: [
              'Check-in time: 3:00 PM',
              'Check-out time: 11:00 AM',
              'Early check-in available upon request (subject to availability)',
              'Late check-out available for an additional fee',
              'Valid government-issued ID required at check-in',
            ],
          },
          {
            heading: 'Conduct & Behavior',
            content: [
              'Guests must respect other guests and property staff',
              'Excessive noise and loud music are prohibited, especially between 10 PM and 7 AM',
              'No disruptive behavior will be tolerated',
              'Guests violating conduct rules may be asked to leave without refund',
              'Smoking is strictly prohibited in all indoor areas',
              'Designated smoking areas are available outside',
            ],
          },
          {
            heading: 'Guests & Occupancy',
            content: [
              'Maximum occupancy limits must be respected as per booking',
              'Unauthorized additional guests are not permitted',
              'Visitors must check in at the front desk',
              'Visitor checkout time is 10:00 PM',
              'Property is not responsible for lost or stolen items',
            ],
          },
          {
            heading: 'Room Care & Damages',
            content: [
              'Guests are responsible for any damage caused to the room or property',
              'Damages will be charged to the guest\'s account',
              'Please report any maintenance issues immediately',
              'Do not attempt to repair any issues yourself',
              'Furniture must not be removed from the room',
              'Walls must not be damaged or marked',
            ],
          },
          {
            heading: 'Facilities & Amenities',
            content: [
              'Pool hours: 7:00 AM - 8:00 PM daily',
              'Gym hours: 6:00 AM - 10:00 PM daily',
              'Guests under 18 must be supervised at all times in pool/spa areas',
              'Alcoholic beverages from outside are not permitted in common areas',
              'Pets are not allowed (unless specified in booking)',
            ],
          },
          {
            heading: 'Security & Safety',
            content: [
              'Valuables should be stored in the room safe',
              'Do not open the door to unknown persons',
              'Report any suspicious activity to the front desk immediately',
              'Emergency exits and fire safety procedures must be observed',
              'Weapons of any kind are strictly prohibited',
            ],
          },
        ],
      },
      'terms-conditions': {
        title: 'Terms and Conditions',
        sections: [
          {
            heading: '1. Acceptance of Terms',
            content:
              'By accessing and using this Travel Booking website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.',
          },
          {
            heading: '2. Use License',
            content: [
              'Permission is granted to temporarily download materials for personal, non-commercial use',
              'Modifying or copying the materials is prohibited',
              'Using materials for any commercial purpose is prohibited',
              'Attempting to decompile or reverse engineer software is prohibited',
              'Removing copyright notices is prohibited',
              'Transferring materials or mirroring on other servers is prohibited',
            ],
          },
          {
            heading: '3. Disclaimer',
            content:
              'The materials on Travel Booking\'s website are provided "as is". Travel Booking makes no warranties, expressed or implied, and disclaims all warranties including merchantability and fitness for a particular purpose.',
          },
          {
            heading: '4. Limitations',
            content:
              'Travel Booking shall not be liable for any damages arising out of the use or inability to use the materials, even if notified of the possibility of such damages.',
          },
          {
            heading: '5. Accuracy of Materials',
            content:
              'Materials appearing on Travel Booking could include technical errors. Travel Booking does not warrant that materials are accurate, complete, or current and may make changes at any time.',
          },
          {
            heading: '6. Cancellation Policy',
            content: [
              'Cancellations 7+ days before check-in: Full refund',
              'Cancellations 3-6 days before check-in: 50% refund',
              'Cancellations less than 3 days before check-in: No refund',
              'No-shows: No refund',
            ],
          },
          {
            heading: '7. Payment Terms',
            content:
              'All prices are in USD and include taxes and service charges unless stated otherwise. Payment must be received before booking confirmation. We accept major credit cards, debit cards, and digital payment methods.',
          },
          {
            heading: '8. Governing Law',
            content:
              'These terms are governed by the laws of the United States, and you submit to the exclusive jurisdiction of courts in that location.',
          },
        ],
      },
      'privacy-policy': {
        title: 'Privacy Policy',
        sections: [
          {
            heading: 'Introduction',
            content:
              'Travel Booking operates the Travel Booking website. This page informs you of our policies regarding collection, use, and disclosure of personal data when you use our Service.',
          },
          {
            heading: 'Information We Collect',
            content: [
              'Account Information: Name, email, phone, date of birth',
              'Payment Information: Credit card details, billing address (encrypted)',
              'Booking Information: Hotel preferences, travel dates, special requests',
              'Usage Data: Browser type, pages visited, time spent, IP address',
              'Location Data: GPS location with permission',
            ],
          },
          {
            heading: 'How We Use Your Data',
            content: [
              'To provide and maintain our Service',
              'To notify you about changes to our Service',
              'To allow you to participate in interactive features',
              'To provide customer support',
              'To improve and monitor our Service',
              'To detect and prevent technical issues',
              'To comply with legal obligations',
            ],
          },
          {
            heading: 'Security of Your Data',
            content: [
              'SSL/TLS encryption for data transmission',
              'PCI-DSS compliance for payment processing',
              'Regular security audits and updates',
              'Restricted access to personal data',
              'Two-factor authentication available',
            ],
          },
          {
            heading: 'Your Rights',
            content: [
              'Right to access your personal data',
              'Right to rectify or correct your data',
              'Right to erase your data',
              'Right to restrict processing',
              'Right to data portability',
              'Right to object to processing',
              'Right to withdraw consent',
            ],
          },
          {
            heading: 'Third-Party Links',
            content:
              'Our Service may contain links to other sites not operated by us. We have no control over third-party content, privacy policies, or practices and assume no responsibility for them.',
          },
          {
            heading: 'Children\'s Privacy',
            content:
              'Our Service does not address anyone under 18 years old. We do not knowingly collect information from children. If you are a parent/guardian and believe your child provided personal data, contact us immediately.',
          },
          {
            heading: 'Contact Us',
            content:
              'Email: privacy@travelbooking.com | Phone: +1-800-774-8279 | Address: 123 Travel Street, New York, NY 10001, USA',
          },
        ],
      },
      'covid-safety': {
        title: 'COVID-19 Safety Requirements',
        sections: [
          {
            heading: 'Overview',
            content:
              'Travel Booking is committed to ensuring the health and safety of our guests and staff. We have implemented comprehensive COVID-19 safety protocols based on CDC and WHO guidelines.',
          },
          {
            heading: 'Vaccination & Testing Requirements',
            content: [
              'Guests should be fully vaccinated or provide proof of negative test within 72 hours',
              'Antigen or PCR tests accepted (present results at check-in)',
              'Medical exemptions available upon verification',
              'Boosters recommended but not currently required',
            ],
          },
          {
            heading: 'Check-in Protocols',
            content: [
              'Health screening questions at check-in',
              'Temperature check (non-contact thermometer)',
              'Presentation of vaccination card or negative test',
              'Mask availability provided upon request',
              'Hand sanitizer and disinfectant wipes available',
            ],
          },
          {
            heading: 'Mask Policy',
            content: [
              'Masks recommended in common areas, elevators, hallways',
              'Masks required in medical/health areas',
              'Masks not required in guest rooms',
              'Masks not required outdoors with proper distancing',
              'Staff must wear masks in guest areas',
            ],
          },
          {
            heading: 'Room Cleaning & Disinfection',
            content: [
              'All rooms deep cleaned and disinfected between guests',
              'High-touch surfaces cleaned multiple times daily',
              'EPA-approved disinfectants used',
              'HEPA air filtration systems in guest rooms',
              'Contactless check-in and checkout available',
              'Increased linen washing frequency and temperature',
            ],
          },
          {
            heading: 'Common Area Safety',
            content: [
              'Physical distancing markers in high-traffic areas',
              'Plexiglass barriers at front desk and service areas',
              'Maximum occupancy limits in elevators',
              'Hand sanitizer stations throughout property',
              'Increased housekeeping for frequent cleanings',
              'Lobby capacity reduced for distancing',
            ],
          },
          {
            heading: 'Illness Reporting & Quarantine',
            content: [
              'Notify front desk immediately if showing COVID-19 symptoms',
              'Quarantine accommodations available in isolated rooms',
              'Meal delivery to rooms during quarantine',
              'Medical assistance coordinated with local providers',
              'All health information kept confidential',
            ],
          },
          {
            heading: 'Staff Safety Measures',
            content: [
              'All staff vaccinated or regularly tested',
              'Daily health screening for all employees',
              'Sick leave available for staff (no penalty)',
              'PPE provided to all staff members',
              'Regular training on safety protocols',
              'Hand hygiene stations for staff use',
            ],
          },
        ],
      },
    };

    return policies[type];
  }
}
