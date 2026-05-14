import { Controller, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NibbitService, ChatMessage } from './nibbit.service';

class NibbitChatDto {
  messages: ChatMessage[];
}

@Controller('nibbit')
@UseGuards(AuthGuard('jwt'))
export class NibbitController {
  constructor(private readonly nibbitService: NibbitService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: NibbitChatDto, @Req() req: any) {
    const tenantName = req.tenant?.name || 'Tu negocio';
    return this.nibbitService.chat(req.tenantConnection, body.messages, tenantName);
  }
}
