#!/usr/bin/env node

/**
 * Form Automation Example
 * Demonstrates comprehensive form interaction and data extraction
 */

import { MCPBrowserControlClient } from '../client/mcp-client.js';

class FormAutomationExample {
  constructor(serverURL = 'http://localhost:3000') {
    this.client = new MCPBrowserControlClient(serverURL);
  }

  async runFormAutomation() {
    console.log('📝 Form Automation Example - Complete Workflow\n');

    try {
      // 1. Create session
      const sessionResult = await this.client.executeTool('create_session', {
        browserType: 'chrome',
        headless: false, // Visual mode for demonstration
        windowSize: { width: 1400, height: 900 }
      });
      const sessionId = sessionResult.data.sessionId;
      console.log(`✅ Session created: ${sessionId}`);

      // 2. Navigate to form test page
      console.log('\n🌐 Navigating to form test page...');
      await this.client.executeTool('navigate_to', {
        url: 'file:///Users/dimitrymd/Documents/prj/MCPBroControl/test-fixtures/pages/dialog-test.html',
        sessionId
      });

      // 3. Extract form structure before filling
      console.log('\n🔍 Analyzing form structure...');
      const formData = await this.client.executeTool('extract_form_data', {
        includeHidden: false,
        includeDisabled: false,
        groupByName: true,
        sessionId
      });

      console.log(`📋 Form Analysis:`);
      console.log(`   Fields found: ${formData.data.fields.length}`);
      console.log(`   Form action: ${formData.data.formAction || 'Not specified'}`);
      console.log(`   Form method: ${formData.data.formMethod}`);

      formData.data.fields.forEach(field => {
        console.log(`   • ${field.name} (${field.type}): ${field.required ? 'Required' : 'Optional'}`);
      });

      // 4. Fill out form fields systematically
      console.log('\n✍️  Filling out form fields...');

      // Text input
      await this.client.executeTool('type_text', {
        selector: '#email-input',
        text: 'test@example.com',
        clear: true,
        sessionId
      });
      console.log('   ✅ Email field filled');

      // Password input
      await this.client.executeTool('type_text', {
        selector: '#password-input',
        text: 'SecurePassword123!',
        clear: true,
        sessionId
      });
      console.log('   ✅ Password field filled');

      // Dropdown selection
      await this.client.executeTool('select_dropdown', {
        selector: '#country-select',
        text: 'United States',
        sessionId
      });
      console.log('   ✅ Country selected');

      // Checkbox interaction
      await this.client.executeTool('click', {
        selector: '#terms-checkbox',
        clickType: 'left',
        sessionId
      });
      console.log('   ✅ Terms checkbox checked');

      // Radio button selection
      await this.client.executeTool('click', {
        selector: '#subscription-premium',
        clickType: 'left',
        sessionId
      });
      console.log('   ✅ Premium subscription selected');

      // 5. Validate form completion
      console.log('\n✔️  Validating form completion...');
      const completedFormData = await this.client.executeTool('extract_form_data', {
        includeHidden: false,
        includeDisabled: false,
        sessionId
      });

      console.log('📊 Completed form state:');
      completedFormData.data.fields.forEach(field => {
        if (field.value) {
          const displayValue = field.type === 'password' ? '*'.repeat(field.value.length) : field.value;
          console.log(`   ${field.name}: ${displayValue}`);
        }
      });

      // 6. Take screenshot before submission
      console.log('\n📸 Capturing form state screenshot...');
      await this.client.executeTool('take_screenshot', {
        selector: '#contact-form',
        format: 'png',
        sessionId
      });

      // 7. Submit form with monitoring
      console.log('\n🚀 Submitting form with network monitoring...');

      // Start network capture
      const captureResult = await this.client.executeTool('start_network_capture', {
        captureTypes: ['xhr', 'fetch'],
        includeHeaders: true,
        includeBody: true,
        sessionId
      });
      const captureId = captureResult.data.captureId;

      // Submit form
      await this.client.executeTool('click', {
        selector: '#submit-button',
        clickType: 'left',
        waitForElement: true,
        sessionId
      });

      // Wait for submission
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get network data
      const networkData = await this.client.executeTool('get_network_data', {
        captureId,
        sessionId
      });

      console.log(`📡 Network activity captured: ${networkData.data.requests.length} requests`);
      networkData.data.requests.forEach(request => {
        console.log(`   ${request.method} ${request.url} → ${request.status}`);
      });

      // Stop network capture
      await this.client.executeTool('stop_network_capture', {
        captureId,
        getData: false,
        sessionId
      });

      // 8. Wait for and handle any dialogs
      console.log('\n💬 Checking for confirmation dialogs...');
      try {
        const alertResult = await this.client.executeTool('handle_alert', {
          action: 'accept',
          timeout: 3000,
          sessionId
        });

        console.log(`✅ Dialog handled: ${alertResult.data.alertType} - "${alertResult.data.alertText}"`);
      } catch (error) {
        console.log('   ℹ️  No dialogs detected');
      }

      // 9. Verify submission success
      console.log('\n🔍 Verifying form submission...');
      await this.client.executeTool('wait_for_text', {
        text: 'success',
        exact: false,
        timeout: 5000,
        sessionId
      });

      const pageContent = await this.client.executeTool('get_page_content', {
        format: 'text',
        selector: '#result-message',
        sessionId
      });

      console.log(`📋 Submission result: ${pageContent.data.content || 'No result message found'}`);

      // 10. Take final screenshot
      console.log('\n📸 Capturing final state...');
      await this.client.executeTool('take_screenshot', {
        fullPage: true,
        format: 'png',
        sessionId
      });

      // Cleanup
      await this.client.executeTool('close_session', { sessionId });

      console.log('\n🎉 Form automation workflow completed successfully!');
      console.log('💼 This demonstrates:');
      console.log('   • Comprehensive form analysis and interaction');
      console.log('   • Real-time network monitoring during submission');
      console.log('   • Automatic dialog handling');
      console.log('   • Visual documentation with screenshots');
      console.log('   • Advanced element interaction with validation');

    } catch (error) {
      console.error('❌ Form automation failed:', error);
      throw error;
    }
  }

  async runQuickFormTest() {
    console.log('⚡ Quick Form Test - Basic Interaction\n');

    try {
      const sessionResult = await this.client.executeTool('create_session', {
        browserType: 'chrome',
        headless: true
      });
      const sessionId = sessionResult.data.sessionId;

      // Navigate to simple form
      await this.client.executeTool('navigate_to', {
        url: 'https://httpbin.org/forms/post',
        sessionId
      });

      // Extract form structure
      const formStructure = await this.client.executeTool('extract_form_data', {
        sessionId
      });

      console.log(`📝 Form has ${formStructure.data.fields.length} fields`);

      // Fill sample field
      if (formStructure.data.fields.length > 0) {
        const firstField = formStructure.data.fields[0];
        if (firstField.type === 'text' || firstField.type === 'email') {
          await this.client.executeTool('type_text', {
            selector: `[name="${firstField.name}"]`,
            text: 'test-value',
            sessionId
          });
          console.log(`✅ Filled field: ${firstField.name}`);
        }
      }

      await this.client.executeTool('close_session', { sessionId });
      console.log('✅ Quick form test completed!');

    } catch (error) {
      console.error('❌ Quick form test failed:', error);
    }
  }
}

// Example usage
async function main() {
  const formTester = new FormAutomationExample();

  console.log('📝 MCP Browser Control Server - Form Automation Examples\n');

  // Run complete workflow
  await formTester.runFormAutomation();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default FormAutomationExample;