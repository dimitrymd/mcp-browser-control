import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PremiumFeatures {
  hasPDFGeneration: boolean;
  hasAdvancedTemplates: boolean;
  pdfGenerator?: any;
}

export class PremiumFeatureLoader {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  public async loadPremiumFeatures(): Promise<PremiumFeatures> {
    const features: PremiumFeatures = {
      hasPDFGeneration: false,
      hasAdvancedTemplates: false
    };

    // Check if PDF generation tool exists
    const pdfToolPath = path.join(__dirname, 'pdf-generation.js');
    if (fs.existsSync(pdfToolPath)) {
      try {
        const { PDFReportGenerator } = await import('./pdf-generation.js');
        features.pdfGenerator = PDFReportGenerator;
        features.hasPDFGeneration = true;
        this.logger.info('✅ Premium PDF generation loaded');
      } catch (error) {
        this.logger.warn('⚠️  PDF generation available but failed to load:', error);
      }
    } else {
      this.logger.info('ℹ️  PDF generation not available (premium feature)');
    }

    // Check if templates exist
    const templatesPath = path.join(__dirname, '../templates/pdf');
    if (fs.existsSync(templatesPath)) {
      features.hasAdvancedTemplates = true;
      this.logger.info('✅ Premium templates loaded');
    }

    return features;
  }

  public createPDFGenerationTool(features: PremiumFeatures) {
    if (!features.hasPDFGeneration) {
      return null;
    }

    return {
      name: "generate_pdf_report",
      description: "🎯 PREMIUM: Generate professional PDF reports from markdown content with emoji support",
      inputSchema: {
        type: "object",
        properties: {
          markdownContent: {
            type: "string",
            description: "Source markdown report content"
          },
          templateType: {
            type: "string",
            enum: ["executive", "technical", "competitive", "seo", "universal"],
            description: "Professional template type for report generation"
          },
          reportTitle: {
            type: "string",
            description: "Report title for cover page and branding"
          },
          clientName: {
            type: "string",
            description: "Client name for personalized branding"
          },
          includeEmojis: {
            type: "boolean",
            default: true,
            description: "Preserve emoji formatting in PDF output"
          }
        },
        required: ["markdownContent", "templateType", "reportTitle"]
      }
    };
  }

  public async executePDFGeneration(features: PremiumFeatures, params: any) {
    if (!features.hasPDFGeneration || !features.pdfGenerator) {
      return {
        success: false,
        error: "PDF generation is a premium feature not available in this installation",
        premiumFeature: true
      };
    }

    try {
      const generator = new features.pdfGenerator();
      return await generator.generatePDFReport(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed'
      };
    }
  }
}

export default PremiumFeatureLoader;